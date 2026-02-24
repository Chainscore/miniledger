# MiniLedger

**The SQLite of private blockchains.** Zero-config, embeddable, SQL-queryable.

```bash
npm install miniledger
```

```typescript
import { MiniLedger } from 'miniledger';

const node = await MiniLedger.create({ dataDir: './my-ledger' });
await node.start();

// Submit a transaction
await node.submit({ key: 'account:alice', value: { balance: 1000 } });

// Query state with SQL
const results = await node.query('SELECT * FROM world_state WHERE key LIKE ?', ['account:%']);

console.log(results);
```

## Features

- **Zero config** — no Docker, no Kubernetes, no certificate authorities
- **SQL queryable** — state stored in SQLite, query with familiar SQL
- **Built-in consensus** — Raft for single-org, PBFT for multi-org
- **Per-record privacy** — field-level encryption with ACLs, no channels
- **On-chain governance** — propose and vote on network changes
- **TypeScript native** — write smart contracts in TypeScript
- **Single process** — everything runs in one Node.js process

## Quick Start

```bash
# Initialize a new ledger
npx miniledger init

# Start the node
npx miniledger start

# Submit a transaction
npx miniledger tx submit '{"key": "hello", "value": "world"}'

# Query state with SQL
npx miniledger query "SELECT * FROM world_state"
```

## License

Apache-2.0
