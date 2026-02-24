import * as path from "node:path";
import * as fs from "node:fs";
import { EventEmitter } from "node:events";
import pino from "pino";
import type { Block, Transaction, NodeStatus, StateEntry, TxType } from "./types.js";
import { TxType as TxTypeEnum } from "./types.js";
import { PROTOCOL_VERSION } from "./constants.js";
import { Chain, createTransaction, validateTransaction } from "./core/index.js";
import { MiniLedgerDB, BlockStore, StateStore, TxStore } from "./storage/index.js";
import {
  generateKeyPair,
  sign,
  verify,
  serializeKeystore,
  deserializeKeystore,
  encryptKeystore,
  decryptKeystore,
  type KeyPair,
} from "./identity/index.js";
import { type MiniLedgerConfig, loadConfig } from "./config/index.js";

// Events: block:created, block:received, tx:submitted, tx:confirmed, started, stopped, error

export interface CreateNodeOptions {
  dataDir?: string;
  config?: Partial<MiniLedgerConfig>;
}

export class MiniLedgerNode extends EventEmitter {
  readonly config: MiniLedgerConfig;
  readonly log: pino.Logger;

  private db!: MiniLedgerDB;
  private blockStore!: BlockStore;
  private stateStore!: StateStore;
  private txStore!: TxStore;
  private chain!: Chain;
  private keyPair!: KeyPair;
  private blockTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private running = false;

  constructor(config: MiniLedgerConfig) {
    super();
    this.config = config;
    this.log = pino({
      level: config.logging.level,
      transport: {
        target: "pino/file",
        options: { destination: 1 }, // stdout
      },
    });
  }

  /** Create a new MiniLedgerNode with optional overrides. */
  static async create(options: CreateNodeOptions = {}): Promise<MiniLedgerNode> {
    const config = loadConfig({
      dataDir: options.dataDir,
      ...options.config,
    });
    const node = new MiniLedgerNode(config);
    return node;
  }

  /** Initialize the node: open DB, load or create identity, restore chain. */
  async init(): Promise<void> {
    // Ensure data directory exists
    fs.mkdirSync(this.config.dataDir, { recursive: true });

    // Open database
    const dbPath = path.join(this.config.dataDir, "ledger.db");
    this.db = new MiniLedgerDB(dbPath);
    this.db.migrate();

    this.blockStore = new BlockStore(this.db.raw());
    this.stateStore = new StateStore(this.db.raw());
    this.txStore = new TxStore(this.db.raw());

    // Load or create keypair
    const keystorePath = path.join(this.config.dataDir, "keystore.json");
    if (fs.existsSync(keystorePath)) {
      const data = fs.readFileSync(keystorePath, "utf-8");
      const ks = deserializeKeystore(data);
      this.keyPair = decryptKeystore(ks, ""); // No password for M1
    } else {
      this.keyPair = generateKeyPair();
      const ks = encryptKeystore(
        this.keyPair,
        "",
        this.config.node.orgId,
        this.config.node.name,
      );
      fs.writeFileSync(keystorePath, serializeKeystore(ks));
    }

    // Initialize chain
    this.chain = new Chain();
    const latestBlock = this.blockStore.getLatest();
    if (latestBlock) {
      this.chain.init(latestBlock);
      this.log.info({ height: latestBlock.height }, "Restored chain from storage");
    } else {
      // Create genesis block
      const genesis = this.chain.createGenesis(this.keyPair.publicKey);
      this.db.raw().transaction(() => {
        this.blockStore.insert(genesis);
      })();
      this.log.info("Created genesis block");
    }
  }

  /** Start the node: begin producing blocks and serving API. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();

    // Start block production timer (solo mode)
    if (this.config.consensus.algorithm === "solo") {
      this.blockTimer = setInterval(() => {
        this.produceBlock().catch((err) => {
          this.log.error({ err }, "Block production error");
          this.emit("error", err as Error);
        });
      }, this.config.consensus.blockTimeMs);
    }

    this.log.info(
      {
        nodeId: this.keyPair.publicKey.substring(0, 16),
        apiPort: this.config.api.enabled ? this.config.network.apiPort : "disabled",
      },
      "Node started",
    );
    this.emit("started");
  }

  /** Stop the node. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.blockTimer) {
      clearInterval(this.blockTimer);
      this.blockTimer = null;
    }

    this.db.close();
    this.log.info("Node stopped");
    this.emit("stopped");
  }

  /** Submit a transaction to the node. */
  async submit(params: {
    type?: TxType;
    key?: string;
    value?: unknown;
    payload?: Transaction["payload"];
  }): Promise<Transaction> {
    const sender = this.keyPair.publicKey;
    const nonce = this.txStore.getNextNonce(sender);

    let payload: Transaction["payload"];
    if (params.payload) {
      payload = params.payload;
    } else if (params.key !== undefined) {
      if (params.value === undefined || params.value === null) {
        payload = { kind: "state:delete", key: params.key };
      } else {
        payload = { kind: "state:set", key: params.key, value: params.value };
      }
    } else {
      throw new Error("Either payload or key must be provided");
    }

    const txType = params.type ?? (payload.kind === "state:delete" ? TxTypeEnum.StateDelete : TxTypeEnum.StateSet);

    const unsignedTx = createTransaction({
      type: txType,
      sender,
      nonce,
      payload,
    });

    // Sign
    const signature = sign(unsignedTx.hash, this.keyPair.privateKey);
    const tx: Transaction = { ...unsignedTx, signature };

    // Validate
    validateTransaction(tx);

    // Verify signature
    if (!verify(tx.hash, tx.signature, tx.sender)) {
      throw new Error("Transaction signature verification failed");
    }

    // Add to pending pool
    this.txStore.addToPending(tx);
    this.emit("tx:submitted", tx);
    this.log.debug({ hash: tx.hash, type: tx.type }, "Transaction submitted");

    return tx;
  }

  /** Query the world state with SQL. */
  async query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    return this.stateStore.query(sql, params);
  }

  /** Get a state entry by key. */
  async getState(key: string): Promise<StateEntry | null> {
    return this.stateStore.get(key);
  }

  /** Get block by height. */
  async getBlock(height: number): Promise<Block | null> {
    return this.blockStore.getByHeight(height);
  }

  /** Get the latest block. */
  async getLatestBlock(): Promise<Block | null> {
    return this.blockStore.getLatest();
  }

  /** Get a transaction by hash. */
  async getTransaction(hash: string): Promise<Transaction | null> {
    return this.txStore.getByHash(hash);
  }

  /** Get node status. */
  getStatus(): NodeStatus {
    const tip = this.chain.getTip();
    return {
      nodeId: this.keyPair.publicKey.substring(0, 16),
      publicKey: this.keyPair.publicKey,
      chainHeight: this.chain.getHeight(),
      latestBlockHash: tip?.hash ?? "",
      peerCount: 0,
      txPoolSize: this.txStore.pendingCount(),
      uptime: this.running ? Date.now() - this.startedAt : 0,
      version: PROTOCOL_VERSION,
    };
  }

  /** Get the node's public key. */
  getPublicKey(): string {
    return this.keyPair.publicKey;
  }

  /** Get the underlying stores (for API routes). */
  getStores() {
    return {
      blocks: this.blockStore,
      state: this.stateStore,
      txs: this.txStore,
    };
  }

  getDatabase() {
    return this.db;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Produce a block from pending transactions. */
  private async produceBlock(): Promise<Block | null> {
    const pending = this.txStore.getPending(this.config.consensus.maxTxPerBlock);

    // Apply transactions to state
    const applied: Transaction[] = [];
    this.db.raw().transaction(() => {
      for (const tx of pending) {
        try {
          this.applyTransaction(tx);
          applied.push(tx);
        } catch (err) {
          this.log.warn({ hash: tx.hash, err }, "Failed to apply transaction");
        }
      }

      if (applied.length === 0) return;

      // Compute state root after all tx applied
      const stateRoot = this.stateStore.computeStateRoot();

      // Create block
      const block = this.chain.proposeBlock(applied, this.keyPair.publicKey, stateRoot);

      // Sign the block
      const signature = sign(block.hash, this.keyPair.privateKey);
      const signedBlock: Block = { ...block, signature };

      // Append to chain and persist
      this.chain.appendBlock(signedBlock);
      this.blockStore.insert(signedBlock);

      // Remove from pending pool
      this.txStore.removePending(applied.map((tx) => tx.hash));

      // Update nonces
      for (const tx of applied) {
        this.txStore.updateNonce(tx.sender, tx.nonce);
      }

      this.log.info(
        { height: signedBlock.height, txCount: applied.length },
        "Block produced",
      );
      this.emit("block:created", signedBlock);
    })();

    return this.chain.getTip();
  }

  /** Apply a single transaction to the world state. */
  private applyTransaction(tx: Transaction): void {
    const { payload } = tx;
    const blockHeight = this.chain.getHeight() + 1;

    switch (payload.kind) {
      case "state:set":
        this.stateStore.set(payload.key, payload.value, tx.sender, blockHeight);
        break;
      case "state:delete":
        this.stateStore.delete(payload.key);
        break;
      default:
        // Other transaction types will be handled in M3 (contracts, governance)
        this.log.warn({ type: tx.type }, "Unhandled transaction type");
    }
  }
}
