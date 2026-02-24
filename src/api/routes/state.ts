import { Hono } from "hono";
import type { MiniLedgerNode } from "../../node.js";

export function stateRoutes(node: MiniLedgerNode): Hono {
  const app = new Hono();

  app.get("/state/:key", async (c) => {
    const key = c.req.param("key");
    const entry = await node.getState(key);
    if (!entry) return c.json({ error: "Key not found" }, 404);
    return c.json(entry);
  });

  /** Execute a SQL query against the world state. The killer feature. */
  app.post("/state/query", async (c) => {
    try {
      const body = await c.req.json();
      const { sql, params = [] } = body as { sql: string; params?: unknown[] };
      if (!sql) return c.json({ error: "Missing sql field" }, 400);
      const results = await node.query(sql, params);
      return c.json({ results, count: results.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query failed";
      return c.json({ error: message }, 400);
    }
  });

  return app;
}
