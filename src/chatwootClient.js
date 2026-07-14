const axios = require('axios');

/**
 * Cria uma instância axios apontando para a API v1 do Chatwoot,
 * usando o token recebido na requisição (nunca armazenado em disco).
 */
function createClient(baseURL, token) {
  return axios.create({
    baseURL: `${String(baseURL).replace(/\/$/, '')}/api/v1`,
    headers: {
      api_access_token: token,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

module.exports = { createClient };
