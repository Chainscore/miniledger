/**
 * Supply Chain Demo Client
 *
 * Run: npx tsx examples/supply-chain/client.ts
 * (Requires a running MiniLedger node on port 4441)
 */

const API = "http://localhost:4441";

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Supply Chain Demo\n");

  // 1. Deploy the supply chain contract
  const { SUPPLY_CHAIN_CONTRACT } = await import("./contracts.js");
  console.log("Deploying supply chain contract...");
  await post("/tx", {
    type: "contract:deploy",
    payload: { kind: "contract:deploy", name: "supply-chain", version: "1.0", code: SUPPLY_CHAIN_CONTRACT },
  });
  await sleep(2000);

  // 2. Create a product
  console.log("Creating product: Organic Coffee Beans...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "supply-chain", method: "createProduct", args: ["PROD-001", "Organic Coffee Beans", "Colombia"] },
  });
  await sleep(2000);

  // 3. Track shipment
  console.log("Updating location: Bogota Port...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "supply-chain", method: "updateLocation", args: ["PROD-001", "Bogota Port", "Loaded onto container ship"] },
  });
  await sleep(2000);

  console.log("Updating location: Panama Canal...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "supply-chain", method: "updateLocation", args: ["PROD-001", "Panama Canal", "In transit"] },
  });
  await sleep(2000);

  console.log("Updating location: Los Angeles Port...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "supply-chain", method: "updateLocation", args: ["PROD-001", "Los Angeles Port", "Cleared customs"] },
  });
  await sleep(2000);

  // 4. Mark delivered
  console.log("Marking as delivered...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "supply-chain", method: "markDelivered", args: ["PROD-001"] },
  });
  await sleep(2000);

  // 5. Query the product
  console.log("\nQuerying product state...");
  const result = await post("/state/query", {
    sql: "SELECT * FROM world_state WHERE key = 'product:PROD-001'",
  });

  if (result.results?.[0]) {
    const product = JSON.parse(result.results[0].value);
    console.log(`\nProduct: ${product.name}`);
    console.log(`Status: ${product.status}`);
    console.log(`Origin: ${product.origin}`);
    console.log(`History (${product.history.length} events):`);
    for (const event of product.history) {
      console.log(`  - ${event.action} ${event.location ? "@ " + event.location : ""}`);
    }
  }

  console.log("\nDone! Check the dashboard at http://localhost:4441/dashboard");
}

main().catch(console.error);
