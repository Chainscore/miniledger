import { Hono } from "hono";
import type { MiniLedgerNode } from "../../node.js";

export function blockRoutes(node: MiniLedgerNode): Hono {
  const app = new Hono();

  app.get("/blocks/latest", async (c) => {
    const block = await node.getLatestBlock();
    if (!block) return c.json({ error: "No blocks" }, 404);
    return c.json(block);
  });

  app.get("/blocks/:height", async (c) => {
    const height = Number.parseInt(c.req.param("height"), 10);
    if (Number.isNaN(height)) return c.json({ error: "Invalid height" }, 400);
    const block = await node.getBlock(height);
    if (!block) return c.json({ error: "Block not found" }, 404);
    return c.json(block);
  });

  app.get("/blocks", async (c) => {
    const stores = node.getStores();
    const currentHeight = stores.blocks.getHeight();
    const from = Math.max(0, currentHeight - 19); // Last 20 blocks
    const blocks = stores.blocks.getRange(from, currentHeight);
    return c.json({ blocks, height: currentHeight });
  });

  return app;
}
