/**
 * Token Transfer Demo
 *
 * Run: npx tsx examples/token-demo/client.ts
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

async function get(path: string) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Token Transfer Demo\n");

  // Get node identity
  const identity = await get("/identity");
  console.log(`Node: ${identity.nodeId}\n`);

  // 1. Deploy token contract
  const { TRANSFER_CONTRACT } = await import("./contracts.js");
  console.log("Deploying token contract...");
  await post("/tx", {
    type: "contract:deploy",
    payload: { kind: "contract:deploy", name: "coin", version: "1.0", code: TRANSFER_CONTRACT },
  });
  await sleep(2000);

  // 2. Mint tokens
  console.log("Minting 1,000,000 tokens...");
  await post("/tx", {
    type: "contract:invoke",
    payload: { kind: "contract:invoke", contract: "coin", method: "mint", args: [1_000_000] },
  });
  await sleep(2000);

  // 3. Check balance
  const balResult = await post("/state/query", {
    sql: `SELECT * FROM world_state WHERE key LIKE 'balance:%'`,
  });
  console.log("\nBalances:");
  for (const row of balResult.results || []) {
    const addr = (row.key as string).replace("balance:", "").substring(0, 16);
    console.log(`  ${addr}... = ${row.value}`);
  }

  console.log("\nDone! Check the dashboard at http://localhost:4441/dashboard");
}

main().catch(console.error);
