import { serve } from "@hono/node-server";
import { exec } from "node:child_process";
import type { Command } from "commander";
import { MiniLedgerNode } from "../../node.js";
import { TxType } from "../../types.js";
import { createApp } from "../../api/server.js";
import { TRANSFER_CONTRACT } from "../../contracts/builtins.js";
import { createTempDir } from "./demo-utils.js";

export function registerDemo(program: Command): void {
  program
    .command("demo")
    .description("Run a 3-node demo cluster with sample data")
    .option("-p, --port <port>", "API port for the primary node", "4441")
    .action(async (opts) => {
      const apiPort = Number.parseInt(opts.port, 10);
      console.log("\n  MiniLedger Demo");
      console.log("  ===============\n");
      console.log("  Starting a 3-node cluster with Raft consensus...\n");

      const dirs: string[] = [];
      const nodes: MiniLedgerNode[] = [];

      try {
        // Create 3 nodes
        for (let i = 0; i < 3; i++) {
          const dir = createTempDir(`miniledger-demo-node${i + 1}-`);
          dirs.push(dir);

          const peers = i > 0 ? [`ws://127.0.0.1:${5440}`] : [];
          const node = await MiniLedgerNode.create({
            dataDir: dir,
            config: {
              node: { name: `demo-node-${i + 1}`, orgId: `org-${i + 1}`, role: "validator" },
              network: {
                listenAddress: "127.0.0.1",
                p2pPort: 5440 + i * 2,
                apiPort: apiPort + i * 2,
                peers,
                maxPeers: 50,
              },
              consensus: { algorithm: "raft", blockTimeMs: 1000, maxTxPerBlock: 500 },
              logging: { level: "warn" },
              api: { enabled: true, cors: true },
            },
          });

          await node.init();
          nodes.push(node);
        }

        // Start nodes with slight delay
        for (let i = 0; i < nodes.length; i++) {
          await nodes[i]!.start();
          const app = createApp(nodes[i]!);
          serve({ fetch: app.fetch, port: apiPort + i * 2 });
          console.log(`  Node ${i + 1}: http://localhost:${apiPort + i * 2}  (P2P: ${5440 + i * 2})`);
          if (i === 0) await sleep(500);
        }

        console.log("\n  Waiting for leader election...");
        await sleep(5000);

        // Find the leader
        const leader = nodes.find((n) => n.getRaft()?.isLeader()) ?? nodes[0]!;
        console.log(`  Leader elected: Node ${nodes.indexOf(leader) + 1}\n`);

        // Submit sample data
        console.log("  Submitting sample transactions...\n");

        // Deploy token contract
        await leader.submit({
          type: TxType.ContractDeploy,
          payload: { kind: "contract:deploy", name: "token", version: "1.0", code: TRANSFER_CONTRACT },
        });
        console.log("  [+] Deployed 'token' contract");

        // Mint tokens
        await leader.submit({
          type: TxType.ContractInvoke,
          payload: { kind: "contract:invoke", contract: "token", method: "mint", args: [10000] },
        });
        console.log("  [+] Minted 10,000 tokens");

        // Add some state
        await leader.submit({ key: "company:acme", value: { name: "Acme Corp", industry: "Manufacturing", employees: 5000 } });
        await leader.submit({ key: "company:globex", value: { name: "Globex Inc", industry: "Finance", employees: 3200 } });
        await leader.submit({ key: "company:initech", value: { name: "Initech LLC", industry: "Technology", employees: 800 } });
        console.log("  [+] Added 3 company records");

        // Create a governance proposal
        await leader.submit({
          type: TxType.GovernancePropose,
          payload: {
            kind: "governance:propose",
            title: "Increase block size to 1000 tx",
            description: "Proposal to double the max transactions per block for better throughput",
            action: { type: "update-config", maxTxPerBlock: 1000 },
          },
        });
        console.log("  [+] Created governance proposal");

        await sleep(2000);

        const status = leader.getStatus();
        console.log(`\n  Cluster running!`);
        console.log(`  Chain height: ${status.chainHeight}`);
        console.log(`  Peers: ${status.peerCount}`);
        console.log(`\n  Dashboard: http://localhost:${apiPort}/dashboard`);
        console.log(`\n  Try these:`);
        console.log(`    curl http://localhost:${apiPort}/status`);
        console.log(`    curl http://localhost:${apiPort}/blocks/latest`);
        console.log(`    curl -X POST http://localhost:${apiPort}/state/query -H "Content-Type: application/json" -d '{"sql":"SELECT * FROM world_state WHERE key LIKE \\'company:%\\'"}'`);
        console.log(`\n  Press Ctrl+C to stop\n`);

        // Try to open browser
        openBrowser(`http://localhost:${apiPort}/dashboard`);

        // Graceful shutdown
        const shutdown = async () => {
          console.log("\n  Shutting down demo...");
          for (const node of nodes) await node.stop();
          for (const dir of dirs) {
            try { require("node:fs").rmSync(dir, { recursive: true, force: true }); } catch {}
          }
          process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
      } catch (err) {
        console.error("  Demo failed:", err);
        for (const node of nodes) await node.stop().catch(() => {});
        process.exit(1);
      }
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`);
}
