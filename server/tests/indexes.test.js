const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, stopTestApp } = require('./helpers/setup');
const Product = require('../src/models/Product');
const InventoryRecord = require('../src/models/InventoryRecord');
const StockMovement = require('../src/models/StockMovement');

const findIndex = async (Model, key) =>
  (await Model.collection.indexes()).find((i) => JSON.stringify(i.key) === JSON.stringify(key));

describe('Indexes the design depends on', () => {
  let server;

  before(async () => {
    ({ server } = await startTestApp());
  });

  after(async () => {
    await stopTestApp(server);
  });

  it('products have a unique index on sku', async () => {
    const index = await findIndex(Product, { sku: 1 });
    assert.ok(index && index.unique);
  });

  it('inventory records have a unique index on productId', async () => {
    const index = await findIndex(InventoryRecord, { productId: 1 });
    assert.ok(index && index.unique);
  });

  it('stock movements have the index that serves the history endpoint', async () => {
    const index = await findIndex(StockMovement, { productId: 1, createdAt: -1, _id: -1 });
    assert.ok(index, 'expected an index on { productId, createdAt desc, _id desc }');
  });
});