# Token Transfer Example

Demonstrates the built-in token contract: minting and checking balances.

## Run

```bash
# Terminal 1: Start a node
miniledger init
miniledger start

# Terminal 2: Run the demo
npx tsx examples/token-demo/client.ts
```

## Query

```sql
SELECT * FROM world_state WHERE key LIKE 'balance:%'
```
