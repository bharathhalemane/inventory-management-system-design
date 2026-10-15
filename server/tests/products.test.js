const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, stopTestApp, resetDb, makeClient, validProduct } = require('./helpers/setup');
const Product = require('../src/models/Product');
const InventoryRecord = require('../src/models/InventoryRecord');

describe('Products API', () => {
  let server;
  let api;

  before(async () => {
    const started = await startTestApp();
    server = started.server;
    api = makeClient(started.baseUrl);
  });

  after(async () => {
    await stopTestApp(server);
  });

  beforeEach(async () => {
    await resetDb();
  });

  const create = (overrides) => api('POST', '/api/v1/products', validProduct(overrides));

  describe('creation', () => {
    it('creates a product with normalized fields and defaults', async () => {
      const res = await create({ sku: ' usb-001 ', name: '  USB-C Cable  ', category: 'Accessories' });
      assert.equal(res.status, 201);
      assert.match(res.headers.get('location'), /^\/api\/v1\/products\/[a-f\d]{24}$/);
      assert.equal(res.body.data.sku, 'USB-001');
      assert.equal(res.body.data.name, 'USB-C Cable');
      assert.equal(res.body.data.category, 'accessories');
      assert.equal(res.body.data.currency, 'INR');
      assert.equal(res.body.data.status, 'active');
    });

    it('creates an inventory record with quantity 0 alongside the product', async () => {
      const res = await create();
      const stock = await api('GET', `/api/v1/products/${res.body.data._id}/stock`);
      assert.equal(stock.status, 200);
      assert.equal(stock.body.data.quantity, 0);
    });

    it('rolls back the product if the inventory record cannot be created', async (t) => {
      // Fault injection: make the second write of the transaction fail.
      t.mock.method(InventoryRecord, 'create', async () => {
        throw new Error('simulated failure');
      });
      const res = await create();
      assert.equal(res.status, 500);
      assert.equal(await Product.countDocuments(), 0);
    });
  });

  describe('invalid input', () => {
    const cases = [
      ['a missing name', { name: undefined }, 'VALIDATION_ERROR'],
      ['a negative price', { priceMinor: -5 }, 'VALIDATION_ERROR'],
      ['a fractional price', { priceMinor: 10.5 }, 'VALIDATION_ERROR'],
      ['a price given as a string', { priceMinor: 'free' }, 'VALIDATION_ERROR'],
      ['bad SKU characters', { sku: 'bad sku!' }, 'VALIDATION_ERROR'],
      ['a bad currency code', { currency: 'rupees' }, 'VALIDATION_ERROR'],
      ['an unknown field (status)', { status: 'inactive' }, 'UNKNOWN_FIELDS'],
      ['an unknown field (_id)', { _id: '1' }, 'UNKNOWN_FIELDS'],
    ];

    for (const [label, overrides, expectedCode] of cases) {
      it(`rejects ${label} with 400 and stores nothing`, async () => {
        const res = await create(overrides);
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, expectedCode);
        assert.equal(await Product.countDocuments(), 0);
        assert.equal(await InventoryRecord.countDocuments(), 0);
      });
    }

    it('reports every field that failed validation', async () => {
      const res = await create({ name: undefined, priceMinor: -5 });
      const fields = res.body.error.details.map((d) => d.field).sort();
      assert.deepEqual(fields, ['name', 'priceMinor']);
    });

    it('rejects malformed JSON with 400', async () => {
      const res = await api('POST', '/api/v1/products', '{bad json');
      assert.equal(res.status, 400);
    });
  });

  describe('duplicate SKUs', () => {
    it('rejects the same SKU with 409', async () => {
      await create({ sku: 'DUP-1' });
      const res = await create({ sku: 'DUP-1', name: 'Another product' });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_SKU');
    });

    it('treats SKUs that differ only by case or spaces as duplicates, leaving exactly one product', async () => {
      await create({ sku: 'DUP-1' });
      const res = await create({ sku: ' dup-1 ' });
      assert.equal(res.status, 409);
      assert.equal(await Product.countDocuments(), 1);
      assert.equal(await InventoryRecord.countDocuments(), 1); // the rejected attempt left no orphan record
    });
  });

  describe('reading', () => {
    it('returns one product by id', async () => {
      const created = await create();
      const res = await api('GET', `/api/v1/products/${created.body.data._id}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.sku, 'USB-001');
    });

    it('returns 400 for a malformed id and 404 for a missing one', async () => {
      const bad = await api('GET', '/api/v1/products/not-an-id');
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.code, 'INVALID_ID');

      const missing = await api('GET', '/api/v1/products/000000000000000000000000');
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'PRODUCT_NOT_FOUND');
    });

    it('paginates without overlap and reports totals', async () => {
      for (let i = 1; i <= 5; i++) {
        await create({ sku: `P-${i}`, name: `Product ${i}` });
      }
      const p1 = await api('GET', '/api/v1/products?limit=2&page=1');
      const p2 = await api('GET', '/api/v1/products?limit=2&page=2');
      const p3 = await api('GET', '/api/v1/products?limit=2&page=3');

      const ids = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((p) => p._id);
      assert.equal(new Set(ids).size, 5);
      assert.equal(p3.body.data.length, 1);
      assert.equal(p1.body.pagination.total, 5);
      assert.equal(p1.body.pagination.totalPage, 3);
    });

    it('filters by category and by text', async () => {
      await create({ sku: 'A-1', name: 'USB Hub', category: 'accessories' });
      await create({ sku: 'A-2', name: 'Mouse', category: 'accessories' });
      await create({ sku: 'C-1', name: 'Laptop', category: 'computers' });

      const byCategory = await api('GET', '/api/v1/products?category=accessories');
      assert.equal(byCategory.body.pagination.total, 2);

      const byText = await api('GET', '/api/v1/products?q=usb');
      assert.deepEqual(byText.body.data.map((p) => p.sku), ['A-1']);
    });

    it('rejects a limit above 100 and treats search text literally', async () => {
      const tooMany = await api('GET', '/api/v1/products?limit=1000');
      assert.equal(tooMany.status, 400);

      await create();
      const literal = await api('GET', '/api/v1/products?q=.*');
      assert.equal(literal.body.pagination.total, 0);
    });
  });

  describe('updating and deactivating', () => {
    it('updates only the fields that were sent', async () => {
      const created = await create();
      const id = created.body.data._id;
      const res = await api('PATCH', `/api/v1/products/${id}`, { priceMinor: 24900 });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.priceMinor, 24900);
      assert.equal(res.body.data.name, 'USB-C Cable');
      assert.ok(new Date(res.body.data.updatedAt) >= new Date(created.body.data.updatedAt));
    });

    it('refuses to change the SKU', async () => {
      const created = await create();
      const res = await api('PATCH', `/api/v1/products/${created.body.data._id}`, { sku: 'NEW-1' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'IMMUTABLE_FIELD');
    });

    it('rejects an empty update and invalid values, leaving the product unchanged', async () => {
      const created = await create();
      const id = created.body.data._id;

      const empty = await api('PATCH', `/api/v1/products/${id}`, {});
      assert.equal(empty.status, 400);

      const negative = await api('PATCH', `/api/v1/products/${id}`, { priceMinor: -1 });
      assert.equal(negative.status, 400);

      const after = await api('GET', `/api/v1/products/${id}`);
      assert.equal(after.body.data.priceMinor, 29900);
    });

    it('deactivates idempotently and hides the product from the default list', async () => {
      const created = await create();
      const id = created.body.data._id;

      const first = await api('DELETE', `/api/v1/products/${id}`);
      const second = await api('DELETE', `/api/v1/products/${id}`);
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.status, 'inactive');

      const defaultList = await api('GET', '/api/v1/products');
      assert.equal(defaultList.body.pagination.total, 0);
      const inactiveList = await api('GET', '/api/v1/products?status=inactive');
      assert.equal(inactiveList.body.pagination.total, 1);
    });

    it('returns 404 when updating or deactivating a missing product', async () => {
      const missing = '000000000000000000000000';
      const patch = await api('PATCH', `/api/v1/products/${missing}`, { name: 'X' });
      const del = await api('DELETE', `/api/v1/products/${missing}`);
      assert.equal(patch.status, 404);
      assert.equal(del.status, 404);
    });
  });
});