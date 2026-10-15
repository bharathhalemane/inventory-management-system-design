const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkStockBody } = require('../../src/validators/stock.validators');

// Runs the middleware and returns whatever it passed to next() (undefined means "accepted").
function run(body) {
  let result = 'next was not called';
  checkStockBody({ body }, {}, (err) => {
    result = err;
  });
  return result;
}

describe('checkStockBody', () => {
  for (const quantity of [1, 50, 1000000]) {
    it(`accepts quantity ${quantity}`, () => {
      assert.equal(run({ quantity }), undefined);
    });
  }

  for (const quantity of [0, -1, 2.5, '5', null, undefined, 1000001]) {
    it(`rejects quantity ${String(quantity)}`, () => {
      const err = run({ quantity });
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
    });
  }

  it('accepts a missing reason', () => {
    assert.equal(run({ quantity: 1 }), undefined);
  });

  it('rejects a reason that is not a string', () => {
    assert.equal(run({ quantity: 1, reason: 5 }).statusCode, 400);
  });

  it('rejects a reason longer than 200 characters', () => {
    assert.equal(run({ quantity: 1, reason: 'x'.repeat(201) }).statusCode, 400);
  });
});