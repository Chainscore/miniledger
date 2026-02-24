import { serve } from "@hono/node-server";
import type { Command } from "commander";
import { DEFAULT_CONFIG } from "../../config/index.js";
import { MiniLedgerNode } from "../../node.js";
import { createApp } from "../../api/server.js";

export function registerStart(program: Command): void {
  program
    .command("start")
    .description("Start the MiniLedger node")
    .option("-d, --data-dir <path>", "Data directory", DEFAULT_CONFIG.dataDir)
    .option("-p, --api-port <port>", "API port", String(DEFAULT_CONFIG.network.apiPort))
    .option("--no-api", "Disable REST API")
    .action(async (opts) => {
      const node = await MiniLedgerNode.create({
        dataDir: opts.dataDir,
        config: {
          network: {
            ...DEFAULT_CONFIG.network,
            apiPort: Number.parseInt(opts.apiPort, 10),
          },
          api: {
            ...DEFAULT_CONFIG.api,
            enabled: opts.api !== false,
          },
        },
      });

      await node.init();
      await node.start();

      // Start HTTP API
      if (node.config.api.enabled) {
        const app = createApp(node);
        serve({
          fetch: app.fetch,
          port: node.config.network.apiPort,
        });

        console.log(`REST API listening on http://localhost:${node.config.network.apiPort}`);
      }

      const status = node.getStatus();
      console.log(`\nMiniLedger node running`);
      console.log(`  Node ID: ${status.nodeId}`);
      console.log(`  Height:  ${status.chainHeight}`);
      console.log(`\nPress Ctrl+C to stop\n`);

      // Graceful shutdown
      const shutdown = async () => {
        console.log("\nShutting down...");
        await node.stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}
