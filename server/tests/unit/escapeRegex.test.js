const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const escapeRegex = require('../../src/utils/escapeRegex');

describe('escapeRegex', () => {
  it('escapes regular-expression metacharacters', () => {
    assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
  });

  it('makes user input match literally', () => {
    const re = new RegExp(escapeRegex('.*'), 'i');
    assert.equal(re.test('anything'), false);
    assert.equal(re.test('a.*b'), true);
  });

  it('leaves ordinary text unchanged', () => {
    assert.equal(escapeRegex('USB cable-1'), 'USB cable-1');
  });
});