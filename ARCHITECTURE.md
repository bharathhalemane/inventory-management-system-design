# Architecture

## Overview

A modular monolith: one Express application, one MongoDB database (a replica set).

```
Client -> Express (routes -> validators -> controllers -> services -> models) -> MongoDB 
                    any error -> central error handler -> consistent JSON
```

- Routes map URLs to controllers. Validators check request shape and safety. Controllers translate HTTP only.
- Services hold the business rules and transactions. Models define stored data and indexes.

## Data model

| Collection | Purpose | Indexes |
|---|---|---|
| `products` | Catalog facts (SKU, name, category, price, status) | `_id`, unique `sku` |
| `inventoryrecords` | Current quantity, exactly one per product | `_id`, unique `productId` |
| `stockmovements` | Append-only ledger of every stock change | `_id`, `{ productId, createdAt desc, _id desc }` |

## Consistency guarantees (what is true today)

- SKUs are unique (a unique index, so the database enforces it).
- Every product has exactly one inventory record, created in the same transaction as the product.
- A removal only succeeds if enough stock remains: the condition is part of the database update, not a separate check.
- A stock change and its movement record commit together or not at all (a transaction).
- For every product, total IN minus total OUT equals the current quantity.
- Movements are never updated or deleted.

## Not guaranteed yet

- Behaviour under concurrent requests is designed for but not yet proven by tests (Phase 4).
- Stock operations are not idempotent (retries repeat the change).
- No authentication: `performedBy` is always `system`.

## Known limitations

- Search (`q`) uses a regular expression and scans the collection. It will be measured and replaced in Phase 2.
- Listing uses offset pagination and a separate count query, both of which get slower as data grows (Phase 2).
- Product updates are read-then-write. This is acceptable for catalog fields and never used for stock.
- Development MongoDB is a single-node replica set. It gives transactions, not redundancy.

## Decision record

| ID | Decision | Why, and the cost |
|---|---|---|
| D1 | Modular monolith first | Simplest to build, run and debug. Everything scales and deploys together |
| D2 | Product and inventory in separate collections | Catalog edits never contend with stock changes. Costs a second document to keep consistent |
| D3 | Current quantity plus an append-only ledger | Fast reads and an audit trail. The two must always agree |
| D4 | Soft delete (deactivate) | Preserves history and references. Queries must filter on status |
| D5 | Layered structure | Business rules live in one testable place. A little more boilerplate |
| D6 | Price as integer minor units | Exact arithmetic. Conversion at the edges |
| D7 | Unique index plus normalization for SKUs | Race-proof uniqueness. SKUs are uppercased and trimmed |
| D8 | Atomic conditional update inside a transaction for stock changes | No overselling, and count and ledger stay consistent. Needs a replica set |
| D9 | Stock may change on inactive products | Returns and write-offs still happen. Revisit if needed |
| D10 | The server sets `performedBy` | A client-supplied identity could be forged |
| D11 | Offset pagination | Simple and supports jumping to a page. Revisited in Phase 2 |
| D12 | Tests refuse to run unless the database name ends in `_test` | Tests delete data, so the guard protects development data |