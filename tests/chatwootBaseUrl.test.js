const assert = require('node:assert/strict');
const test = require('node:test');
const { getChatwootBaseUrl } = require('../src/utils/chatwootBaseUrl');

test('uses the default Chatwoot URL when no instance is provided', () => {
  const env = {
    CHATWOOT_BASE_URL: 'https://default.example.com',
    CHATWOOT_BASE_URL_1: 'https://one.example.com'
  };

  assert.equal(getChatwootBaseUrl(undefined, env), 'https://default.example.com');
});

test('uses the URL configured for the requested instance', () => {
  const env = {
    CHATWOOT_BASE_URL: 'https://default.example.com',
    CHATWOOT_BASE_URL_1: 'https://one.example.com',
    CHATWOOT_BASE_URL_2: 'https://two.example.com'
  };

  assert.equal(getChatwootBaseUrl(1, env), 'https://one.example.com');
  assert.equal(getChatwootBaseUrl(2, env), 'https://two.example.com');
});

test('returns undefined when the requested instance URL is not configured', () => {
  assert.equal(getChatwootBaseUrl(3, { CHATWOOT_BASE_URL: 'https://default.example.com' }), undefined);
});
