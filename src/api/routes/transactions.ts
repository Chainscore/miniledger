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

  // Static paths MUST be registered before parameterized paths
  app.get("/tx/recent", async (c) => {
    const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "20", 10) || 20));
    const typeFilter = c.req.query("type") ?? "";
    const offset = (page - 1) * limit;

    try {
      let countSql = "SELECT COUNT(*) as total FROM transactions WHERE status = 'confirmed'";
      let dataSql = "SELECT hash, type, sender, nonce, timestamp, payload, signature, block_height, position FROM transactions WHERE status = 'confirmed'";
      const params: unknown[] = [];
      const countParams: unknown[] = [];

      if (typeFilter) {
        countSql += " AND type = ?";
        dataSql += " AND type = ?";
        params.push(typeFilter);
        countParams.push(typeFilter);
      }

      dataSql += " ORDER BY block_height DESC, position DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const db = node.getDatabase().raw();
      const countRow = db.prepare(countSql).get(...countParams) as { total: number };
      const rows = db.prepare(dataSql).all(...params) as {
        hash: string; type: string; sender: string; nonce: number;
        timestamp: number; payload: string; signature: string;
        block_height: number | null; position: number | null;
      }[];

      const transactions = rows.map((r) => ({
        hash: r.hash,
        type: r.type,
        sender: r.sender,
        nonce: r.nonce,
        timestamp: r.timestamp,
        payload: JSON.parse(r.payload),
        signature: r.signature,
        blockHeight: r.block_height,
      }));

      const totalPages = Math.ceil(countRow.total / limit);
      return c.json({ transactions, total: countRow.total, page, limit, totalPages });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query failed";
      return c.json({ error: message }, 500);
    }
  });

  app.get("/tx/sender/:pubkey", async (c) => {
    const pubkey = c.req.param("pubkey");
    const transactions = node.getStores().txs.getBySender(pubkey, 200);
    return c.json({ transactions, count: transactions.length });
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
