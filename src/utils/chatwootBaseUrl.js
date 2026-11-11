function getChatwootBaseUrl(instanceId, env = process.env) {
  const key = instanceId === undefined
    ? 'CHATWOOT_BASE_URL'
    : `CHATWOOT_BASE_URL_${instanceId}`;
  return env[key];
}

module.exports = { getChatwootBaseUrl };
