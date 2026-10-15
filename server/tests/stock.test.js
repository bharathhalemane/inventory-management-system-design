const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp, stopTestApp, resetDb, makeClient, validProduct } = require('./helpers/setup');
const StockMovement = require('../src/models/StockMovement');
const stockService = require('../src/services/stock.service');

describe('Stock API', () => {
  let server;
  let api;
  let productId;

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
    const res = await api('POST', '/api/v1/products', validProduct());
    productId = res.body.data._id;
  });

  const stockUrl = (suffix = '') => `/api/v1/products/${productId}/stock${suffix}`;
  const add = (quantity, reason) => api('POST', stockUrl('/add'), { quantity, reason });
  const remove = (quantity, reason) => api('POST', stockUrl('/remove'), { quantity, reason });
  const currentQuantity = async () => (await api('GET', stockUrl())).body.data.quantity;
  // Newest first, up to 100 entries.
  const history = async () => (await api('GET', `/api/v1/products/${productId}/movements?limit=100`)).body.data;

  describe('adding stock', () => {
    it('starts at zero', async () => {
      assert.equal(await currentQuantity(), 0);
    });

    it('adds stock and records an IN movement', async () => {
      const res = await add(50, 'Initial delivery');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.inventory.quantity, 50);

      const m = res.body.data.movement;
      assert.equal(m.type, 'IN');
      assert.equal(m.quantity, 50);
      assert.equal(m.quantityBefore, 0);
      assert.equal(m.quantityAfter, 50);
      assert.equal(m.reason, 'Initial delivery');
      assert.equal(m.performedBy, 'system');
      assert.equal(await currentQuantity(), 50);
    });

    it('accumulates across several additions', async () => {
      await add(10);
      await add(5);
      assert.equal(await currentQuantity(), 15);
      assert.equal((await history()).length, 2);
    });
  });

  describe('removing stock', () => {
    it('decreases stock and records an OUT movement', async () => {
      await add(50);
      const res = await remove(20, 'Sale');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.inventory.quantity, 30);

      const m = res.body.data.movement;
      assert.equal(m.type, 'OUT');
      assert.equal(m.quantityBefore, 50);
      assert.equal(m.quantityAfter, 30);
    });

    it('allows removing exactly everything, then rejects one more', async () => {
      await add(30);
      const all = await remove(30);
      assert.equal(all.status, 200);
      assert.equal(all.body.data.inventory.quantity, 0);

      const extra = await remove(1);
      assert.equal(extra.status, 409);
      assert.equal(extra.body.error.details.available, 0);
    });
  });

  describe('insufficient stock', () => {
    it('rejects with 409, explains why, and changes nothing', async () => {
      await add(30);
      const res = await remove(100);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
      assert.deepEqual(res.body.error.details, { available: 30, requested: 100 });

      assert.equal(await currentQuantity(), 30);
      assert.equal((await history()).length, 1); // the failed attempt left no movement
    });

    it('rejects a removal when stock was never added', async () => {
      const res = await remove(1);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.details.available, 0);
    });
  });

  describe('invalid requests', () => {
    const badQuantities = [
      ['zero', 0],
      ['negative', -1],
      ['fractional', 2.5],
      ['string', '5'],
      ['null', null],
      ['too large', 1000001],
    ];

    for (const operation of ['add', 'remove']) {
      for (const [label, value] of badQuantities) {
        it(`${operation}: rejects a ${label} quantity and changes nothing`, async () => {
          const res = await api('POST', stockUrl(`/${operation}`), { quantity: value });
          assert.equal(res.status, 400);
          assert.equal(await currentQuantity(), 0);
          assert.equal((await history()).length, 0);
        });
      }
    }

    it('rejects a request with no quantity', async () => {
      const res = await api('POST', stockUrl('/add'), { reason: 'forgot the quantity' });
      assert.equal(res.status, 400);
    });

    it('does not let the client choose who performed the change', async () => {
      const res = await api('POST', stockUrl('/add'), { quantity: 5, performedBy: 'admin' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'UNKNOWN_FIELDS');
      assert.equal(await currentQuantity(), 0);
    });
  });

  describe('missing products', () => {
    it('returns 404 for stock, add, remove and history of a product that does not exist', async () => {
      const base = '/api/v1/products/000000000000000000000000';
      const requests = [
        ['GET', `${base}/stock`, undefined],
        ['POST', `${base}/stock/add`, { quantity: 1 }],
        ['POST', `${base}/stock/remove`, { quantity: 1 }],
        ['GET', `${base}/movements`, undefined],
      ];
      for (const [method, url, body] of requests) {
        const res = await api(method, url, body);
        assert.equal(res.status, 404, `${method} ${url}`);
        assert.equal(res.body.error.code, 'PRODUCT_NOT_FOUND');
      }
    });

    it('returns 400 for a malformed product id', async () => {
      const res = await api('GET', '/api/v1/products/not-an-id/stock');
      assert.equal(res.status, 400);
    });
  });

  describe('inventory history', () => {
    it('lists movements newest first, each starting where the previous one ended', async () => {
      await add(100);
      await remove(30);
      await add(5);
      await remove(10);

      const movements = await history();
      assert.deepEqual(movements.map((m) => m.type), ['OUT', 'IN', 'OUT', 'IN']);
      assert.equal(movements[0].quantityAfter, 65);
      for (let i = 0; i < movements.length - 1; i++) {
        assert.equal(movements[i].quantityBefore, movements[i + 1].quantityAfter);
      }
    });

    it('paginates without overlap', async () => {
      for (let i = 0; i < 5; i++) await add(1);
      const pages = [];
      for (const page of [1, 2, 3]) {
        const res = await api('GET', `/api/v1/products/${productId}/movements?limit=2&page=${page}`);
        pages.push(...res.body.data);
      }
      assert.equal(new Set(pages.map((m) => m._id)).size, 5);
    });

    it('always reconciles: total IN minus total OUT equals the current quantity', async () => {
      await add(40);
      await remove(25);
      await remove(30); // fails: only 15 available
      await add(7);
      await remove(20);
      await remove(1000); // fails

      const movements = await history();
      const net = movements.reduce((sum, m) => sum + (m.type === 'IN' ? m.quantity : -m.quantity), 0);
      assert.equal(movements.length, 4); // only the successful operations were recorded
      assert.equal(net, await currentQuantity());
      assert.equal(net, 2);
    });
  });

  describe('atomicity', () => {
    it('rolls back the stock change when the movement cannot be written', async (t) => {
      await add(10);

      // Fault injection: the second write of the transaction fails.
      t.mock.method(StockMovement, 'create', async () => {
        throw new Error('simulated movement failure');
      });
      await assert.rejects(() => stockService.addStock(productId, { quantity: 5, reason: 'x' }), /simulated movement failure/);

      assert.equal(await currentQuantity(), 10); // still 10, not 15
      assert.equal((await history()).length, 1);
    });
  });
});