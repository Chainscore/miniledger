import { Hono } from "hono";

/** Placeholder for M2 network routes. */
export function networkRoutes(): Hono {
  const app = new Hono();

  app.get("/peers", (c) => {
    return c.json({ peers: [], count: 0, message: "Networking available in M2" });
  });

  return app;
}
