const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizePhone } = require('../src/utils/phone');

test('normalizes an international number without a plus sign', () => {
  assert.equal(normalizePhone('33604416702'), '+33604416702');
});

test('normalizes formatted international numbers', () => {
  assert.equal(normalizePhone('+33 (6) 04-41-67-02'), '+33604416702');
});

test('converts the international dialing prefix 00 to plus', () => {
  assert.equal(normalizePhone('0033 6 04 41 67 02'), '+33604416702');
});

test('returns null when no phone digits are provided', () => {
  assert.equal(normalizePhone(' + ()- '), null);
});
