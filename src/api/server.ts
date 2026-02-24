import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiniLedgerNode } from "../node.js";
import { requestLogger } from "./middleware/logging.js";
import { healthRoutes } from "./routes/health.js";
import { blockRoutes } from "./routes/blocks.js";
import { transactionRoutes } from "./routes/transactions.js";
import { stateRoutes } from "./routes/state.js";
import { identityRoutes } from "./routes/identity.js";
import { networkRoutes } from "./routes/network.js";
import { governanceRoutes } from "./routes/governance.js";

export function createApp(node: MiniLedgerNode): Hono {
  const app = new Hono();

  // Global middleware
  if (node.config.api.cors) {
    app.use("*", cors());
  }
  app.use("*", requestLogger());

  // Mount routes
  app.route("/", healthRoutes(node));
  app.route("/", blockRoutes(node));
  app.route("/", transactionRoutes(node));
  app.route("/", stateRoutes(node));
  app.route("/", identityRoutes(node));
  app.route("/", networkRoutes(node));
  app.route("/", governanceRoutes(node));

  // Root info
  app.get("/", (c) => {
    return c.json({
      name: "miniledger",
      version: "0.1.0",
      status: node.isRunning() ? "running" : "stopped",
    });
  });

  return app;
}
