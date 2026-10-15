const path = require('node:path');

// 1) Load .env.test BEFORE any application module is required. dotenv never overwrites variables that
//    are already set, so src/config's own dotenv call (which reads .env) cannot replace these values.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.test'), override: true, quiet: true });
process.env.NODE_ENV = 'test';

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is not set. Create .env.test from .env.test.example before running tests.');
}

const mongoose = require('mongoose');
const app = require('../../src/app');
const { connectDB, disconnectDB } = require('../../src/config/db');
const Product = require('../../src/models/Product');
const InventoryRecord = require('../../src/models/InventoryRecord');
const StockMovement = require('../../src/models/StockMovement');

// The safety net: tests delete data, so they may only run against a database whose name ends in "_test".
function assertTestDatabase() {
  const name = mongoose.connection.name;
  if (!name || !name.endsWith('_test')) {
    throw new Error(`Refusing to run tests: database "${name}" does not end with "_test".`);
  }
}

async function startTestApp() {
  await connectDB();
  try {
    assertTestDatabase();
  } catch (err) {
    await disconnectDB();
    throw err;
  }

  // Make sure indexes (including the unique ones) exist before the first test.
  await Promise.all([Product.init(), InventoryRecord.init(), StockMovement.init()]);

  // Port 0 asks the operating system for any free port, so tests never clash with your dev server.
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function stopTestApp(server) {
  await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
}

// Empties the collections (keeps the indexes). Guarded again here, as defense in depth.
async function resetDb() {
  assertTestDatabase();
  await Promise.all([Product.deleteMany({}), InventoryRecord.deleteMany({}), StockMovement.deleteMany({})]);
}

// A tiny HTTP client. A string body is sent as-is (useful for malformed JSON); anything else is JSON-encoded.
function makeClient(baseUrl) {
  return async function api(method, url, body) {
    const hasBody = body !== undefined;
    const res = await fetch(baseUrl + url, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
}

function validProduct(overrides = {}) {
  return { sku: 'USB-001', name: 'USB-C Cable', category: 'accessories', priceMinor: 29900, ...overrides };
}

module.exports = { startTestApp, stopTestApp, resetDb, makeClient, validProduct };