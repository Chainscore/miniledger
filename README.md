# MiniLedger

**The SQLite of private blockchains.** Zero-config, embeddable, SQL-queryable.

```
npm install miniledger
```

MiniLedger is a private/permissioned blockchain that runs in a single Node.js process. No Docker. No Kubernetes. No certificate authorities. Just `npm install` and go.

## Quick Start

```bash
# Initialize and start a node
npx miniledger init
npx miniledger start

# Submit a transaction
curl -X POST http://localhost:4441/tx \
  -H "Content-Type: application/json" \
  -d '{"key": "account:alice", "value": {"balance": 1000}}'

# Query state with SQL (!)
curl -X POST http://localhost:4441/state/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM world_state"}'

# Open the dashboard
open http://localhost:4441/dashboard
```

## 30-Second Demo

```bash
npx miniledger demo
```

Spins up a 3-node Raft cluster, deploys contracts, submits sample data, and opens a web dashboard.

## Programmatic API

```typescript
import { MiniLedger } from 'miniledger';

const node = await MiniLedger.create({ dataDir: './my-ledger' });
await node.init();
await node.start();

// Submit a transaction
await node.submit({ key: 'account:alice', value: { balance: 1000 } });

// Query state with SQL
const results = await node.query(
  'SELECT * FROM world_state WHERE key LIKE ?',
  ['account:%']
);

// Deploy a smart contract
await node.submit({
  type: 'contract:deploy',
  payload: {
    kind: 'contract:deploy',
    name: 'token',
    version: '1.0',
    code: `return {
      mint(ctx, amount) {
        const bal = ctx.get("balance:" + ctx.sender) || 0;
        ctx.set("balance:" + ctx.sender, bal + amount);
      }
    }`
  }
});
```

## Features

| Feature | Description |
|---------|-------------|
| **Zero config** | No Docker, no K8s, no certificate authorities. Single process. |
| **SQL queryable** | State stored in SQLite. Query with `SELECT * FROM world_state`. |
| **Raft consensus** | Leader election, log replication, fault tolerance. |
| **Smart contracts** | Write contracts in JavaScript. Deploy via transactions. |
| **Per-record privacy** | AES-256-GCM field encryption with ACLs. No channels. |
| **On-chain governance** | Propose and vote on network changes. Quorum-based. |
| **Web dashboard** | Built-in block explorer, state browser, SQL console. |
| **P2P networking** | WebSocket mesh with auto-reconnect and peer discovery. |
| **Ed25519 identity** | Audited crypto. No PKI setup required. |
| **TypeScript native** | Full type safety. Dual CJS/ESM package. |

## Architecture

```
                    ┌───────────┐
                    │    CLI    │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │   Node    │  (orchestrator)
                    └─────┬─────┘
                          │
      ┌───────┬───────┬───┴───┬───────┬───────┐
      │       │       │       │       │       │
   ┌──▼──┐ ┌─▼───┐ ┌─▼────┐ ┌▼─────┐ ┌▼────┐ ┌▼───────┐
   │ API │ │Raft │ │ P2P  │ │Contr.│ │Gov. │ │Privacy │
   └──┬──┘ └──┬──┘ └──┬───┘ └──┬───┘ └──┬──┘ └───┬────┘
      └───────┴───────┴────┬───┴────────┴────────┘
                    ┌──────▼──────┐
                    │    Core     │  (blocks, transactions, merkle)
                    └──────┬──────┘
              ┌────────────┼────────────┐
        ┌─────▼─────┐           ┌──────▼─────┐
        │  SQLite    │           │  Ed25519    │
        └────────────┘           └─────────────┘
```

## Multi-Node Cluster

```bash
# Node 1 (bootstrap)
miniledger init -d ./node1
miniledger start -d ./node1 --consensus raft --p2p-port 4440 --api-port 4441

# Node 2
miniledger init -d ./node2
miniledger join ws://localhost:4440 -d ./node2 --p2p-port 4442 --api-port 4443

# Node 3
miniledger init -d ./node3
miniledger join ws://localhost:4440 -d ./node3 --p2p-port 4444 --api-port 4445
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `miniledger init` | Initialize a new node (create keys, genesis block) |
| `miniledger start` | Start the node |
| `miniledger join <addr>` | Join an existing network |
| `miniledger demo` | Run a 3-node demo cluster |
| `miniledger status` | Show node status |
| `miniledger tx submit <json>` | Submit a transaction |
| `miniledger query <sql>` | Query state with SQL |
| `miniledger keys show` | Show node's public key |
| `miniledger peers list` | List connected peers |

## REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Node status (height, peers, uptime) |
| `/blocks` | GET | Recent blocks |
| `/blocks/:height` | GET | Block by height |
| `/blocks/latest` | GET | Latest block |
| `/tx` | POST | Submit transaction |
| `/tx/:hash` | GET | Transaction by hash |
| `/state/:key` | GET | State entry by key |
| `/state/query` | POST | SQL query (`{sql: "SELECT ..."}`) |
| `/peers` | GET | Connected peers |
| `/consensus` | GET | Consensus state |
| `/proposals` | GET | Governance proposals |
| `/contracts` | GET | Deployed contracts |
| `/dashboard` | GET | Web dashboard |

## Comparison

| | MiniLedger | Hyperledger Fabric | R3 Corda |
|---|---|---|---|
| **Setup time** | 10 seconds | Hours/days | Hours |
| **Dependencies** | `npm install` | Docker, K8s, CAs | JVM, Corda node |
| **Config files** | 0 (auto) | Dozens of YAML | Multiple configs |
| **Consensus** | Raft (built-in) | Raft (separate orderer) | Notary service |
| **Smart contracts** | JavaScript | Go/Java/Node | Kotlin/Java |
| **State queries** | SQL | CouchDB queries | JPA/Vault |
| **Privacy** | Per-record ACLs | Channels (complex) | Point-to-point |
| **Governance** | On-chain voting | Off-chain manual | Off-chain |
| **Dashboard** | Built-in | None (3rd party) | None |

## Tech Stack

- **Runtime:** Node.js >= 22
- **State:** SQLite (better-sqlite3, WAL mode)
- **Crypto:** @noble/ed25519 + @noble/hashes (audited, pure JS)
- **P2P:** WebSocket mesh (ws)
- **HTTP:** Hono
- **CLI:** Commander
- **Build:** tsup (dual CJS/ESM)
- **Tests:** Vitest

## License

Apache-2.0
