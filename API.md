# API Reference

Base path: `/api/v1`. All bodies are JSON. Money is an integer in minor units (`priceMinor: 19900` means 199.00).

## Errors

Every error has this shape:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Cannot remove 100; only 30 available", "details": { "available": 30, "requested": 100 } } }
```

`details` appears for validation failures (a list of `{ field, message }`) and for insufficient stock.

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_BODY`, `UNKNOWN_FIELDS`, `IMMUTABLE_FIELD`, `INVALID_QUERY`, `BAD_REQUEST` |
| 404 | `PRODUCT_NOT_FOUND`, `NOT_FOUND` |
| 409 | `DUPLICATE_SKU`, `INSUFFICIENT_STOCK` |
| 500 | `INTERNAL_ERROR` |

## Health

`GET /health` returns 200 with `"database": "connected"`, or 503 with `"database": "unreachable"`.

## Products

| Method | Path | Success | Notes |
|---|---|---|---|
| POST | `/products` | 201 + `Location` header | Body: `sku`, `name`, `category`, `priceMinor` (required); `description`, `currency` (optional). Creates the inventory record (quantity 0) too |
| GET | `/products` | 200 | Query: `page` (default 1), `limit` (1 to 100, default 20), `category`, `status` (`active` default, `inactive`, `all`), `q` (name contains, or SKU starts with) |
| GET | `/products/:id` | 200 | |
| PATCH | `/products/:id` | 200 | Any of `name`, `description`, `category`, `priceMinor`, `currency`, `status`. The SKU cannot be changed |
| DELETE | `/products/:id` | 200 | Deactivates (sets `status: "inactive"`). Idempotent |

List response:

```json
{ "data": [ { "_id": "...", "sku": "USB-001", "name": "USB-C Cable", "category": "accessories", "priceMinor": 29900, "currency": "INR", "status": "active" } ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

## Stock

| Method | Path | Success | Notes |
|---|---|---|---|
| GET | `/products/:id/stock` | 200 | `{ data: { productId, quantity, updatedAt } }` |
| POST | `/products/:id/stock/add` | 200 | Body: `quantity` (whole number, 1 to 1,000,000), optional `reason` (max 200 chars) |
| POST | `/products/:id/stock/remove` | 200 | Same body. 409 `INSUFFICIENT_STOCK` if fewer units are available |
| GET | `/products/:id/movements` | 200 | Newest first. Query: `page`, `limit` |

Add and remove return `{ data: { inventory, movement } }`. A movement has `type` (`IN` or `OUT`), `quantity`, `quantityBefore`,
`quantityAfter`, `reason`, `performedBy` (set by the server) and `createdAt`.

Known limitation: stock operations are not idempotent. Retrying `add` after a timeout adds the stock twice.