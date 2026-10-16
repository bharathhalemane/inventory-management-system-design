# Inventory Management System

A backend API for tracking products and stock, built step by step to learn practical system design.
Stack: Node.js, Express 5, MongoDB (Mongoose). Architecture: modular monolith.

## What it does (Phase 1)

- Product catalog: create, read, list (pagination, filters, name/SKU search), update, deactivate.
- Inventory: current stock per product, add stock, remove stock, full movement history.
- Stock can never go negative, every change is recorded, and a stock change and its history record
  succeed or fail together.

## Quick start

Prerequisites: Node.js 22, and MongoDB 8 running as a replica set (needed for transactions, see
DEVELOPMENT.md).

```powershell
npm install
Copy-Item .env.example .env     # then edit the values
npm run dev
```

Check it is running: http://localhost:5000/health

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with automatic restart on file changes |
| `npm start` | Start normally |
| `npm test` | Run all unit and integration tests (needs `.env.test`) |

## Project layout

```
src/
  config/        environment and database connection
  models/        Mongoose schemas (Product, InventoryRecord, StockMovement)
  routes/        URL -> controller mapping
  controllers/   HTTP in and out only
  services/      business rules and transactions
  middleware/    validation helpers, not-found, error handler
  validators/    request rules per resource
  utils/         AppError, escapeRegex
tests/           unit tests and integration tests
scripts/         one-off scripts (backfill, demos)
```

## Documentation

- [API.md](API.md): every endpoint with examples and error codes
- [ARCHITECTURE.md](ARCHITECTURE.md): design, guarantees, limitations and decision record
- [DEVELOPMENT.md](DEVELOPMENT.md): setup, environments, testing guide, troubleshooting