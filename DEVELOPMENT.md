# Development Guide

## Prerequisites

- Node.js 22
- MongoDB 8 running as a **single-node replica set** named `rs0` (transactions require a replica set)
- Windows PowerShell notes are included where commands differ from Unix

## One-time MongoDB replica set setup (Windows)

1. Add to `mongod.cfg` (the service reads the file shown by
   `(Get-CimInstance Win32_Service -Filter "Name='MongoDB'").PathName`), keeping `replication:` at the start of its line:
```yaml
   replication:
     replSetName: rs0
```
2. Run PowerShell as Administrator: `Restart-Service MongoDB`
3. Initiate: `mongosh "mongodb://127.0.0.1:27017" --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"`
4. Verify: `mongosh "mongodb://127.0.0.1:27017" --quiet --eval "db.hello().setName"` prints `rs0`.

## Environments

| File | Used by | Database |
|---|---|---|
| `.env` | `npm run dev`, `npm start` | `inventory_db` |
| `.env.test` | `npm test` | `inventory_test` |
| `.env.bench` | benchmark scripts (Phase 2) | `inventory_bench` |

Each URI ends with `?replicaSet=rs0`. Real `.env*` files are never committed. Only the `.example` files are.
Create files with `Set-Content -Encoding ascii` so PowerShell does not add a byte-order mark.

## Testing guide

- `npm test` runs unit tests (`tests/unit`, no database) and integration tests (`tests/*.test.js`, real Express app and a real
  MongoDB test database).
- Test files must end in `.test.js`, or the runner will not find them.
- Files run one at a time (`--test-concurrency=1`) because they share one database. Every test starts from empty collections.
- Safety: the test setup refuses to run unless the connected database name ends with `_test`, and `src/config/env.js` does not
  read `.env` when `NODE_ENV=test`.
- Failure paths are tested too, including fault injection that proves transactions roll back.
- These tests run requests one at a time. They do not prove behaviour under concurrent requests (Phase 4).
- To check a test can fail, break the code on purpose, run `npm test`, then restore it.

## One-off scripts

| Script | Purpose |
|---|---|
| `node scripts/backfill-inventory.js` | Adds missing inventory records (safe to re-run) |
| `node scripts/demo-partial-failure.js` | Shows why stock updates need a transaction |

## PowerShell tips

- Use `curl.exe`, not `curl` (which is an alias for `Invoke-WebRequest`).
- Send JSON by piping: `'{"quantity":5}' | curl.exe -s -i -X POST <url> -H "Content-Type: application/json" --data-binary "@-"`
- For `mongosh --eval`, wrap the script in double quotes and use single quotes inside.

## Git conventions

Small commits at milestone boundaries. Messages: `feat:`, `fix:`, `test:`, `docs:`, `chore:` followed by what changed.
Tags mark finished phases (`phase-1-complete`).