import { Hono } from "hono";
import { z } from "zod";
import type { MiniLedgerNode } from "../../node.js";
import { TxType } from "../../types.js";

const submitTxSchema = z.object({
  key: z.string().optional(),
  value: z.unknown().optional(),
  type: z.nativeEnum(TxType).optional(),
  payload: z
    .object({
      kind: z.string(),
    })
    .passthrough()
    .optional(),
});

export function transactionRoutes(node: MiniLedgerNode): Hono {
  const app = new Hono();

  app.post("/tx", async (c) => {
    try {
      const body = await c.req.json();
      const parsed = submitTxSchema.parse(body);
      const tx = await node.submit({
        type: parsed.type,
        key: parsed.key,
        value: parsed.value,
        payload: parsed.payload as any,
      });
      return c.json({ hash: tx.hash, status: "pending" }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  app.get("/tx/:hash", async (c) => {
    const hash = c.req.param("hash");
    const tx = await node.getTransaction(hash);
    if (!tx) return c.json({ error: "Transaction not found" }, 404);
    return c.json(tx);
  });

  app.get("/tx", (c) => {
    const stores = node.getStores();
    const pending = stores.txs.getPending(100);
    return c.json({ pending, count: pending.length });
  });

  return app;
}
