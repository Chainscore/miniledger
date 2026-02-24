import { Hono } from "hono";

/** Placeholder for M3 governance routes. */
export function governanceRoutes(): Hono {
  const app = new Hono();

  app.get("/proposals", (c) => {
    return c.json({ proposals: [], count: 0, message: "Governance available in M3" });
  });

  return app;
}
