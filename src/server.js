require('dotenv').config();
const express = require('express');
const { createClient } = require('./chatwootClient');
const { normalizePhone } = require('./utils/phone');

const app = express();
app.use(express.json());

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL;
const PORT = process.env.PORT || 3000;
const DEFAULT_CONTACT_NAME_PREFIX = process.env.DEFAULT_CONTACT_NAME_PREFIX || 'WhatsApp';

if (!CHATWOOT_BASE_URL) {
  console.error('CHATWOOT_BASE_URL não definido. Configure o .env antes de iniciar.');
  process.exit(1);
}

/**
 * Extrai o token do Chatwoot enviado pelo cliente.
 * Aceita tanto o header nativo do Chatwoot (api_access_token)
 * quanto Authorization: Bearer <token>.
 */
function getToken(req) {
  const direct = req.header('api_access_token');
  if (direct) return direct;

  const auth = req.header('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

async function findContactByPhone(client, accountId, phone) {
  const { data } = await client.get(`/accounts/${accountId}/contacts/search`, {
    params: { q: phone }
  });
  const results = data?.payload || [];
  return results.find((c) => c.phone_number === phone) || null;
}

async function createContact(client, accountId, inboxId, phone, name) {
  const { data } = await client.post(`/accounts/${accountId}/contacts`, {
    inbox_id: inboxId,
    name: name || `${DEFAULT_CONTACT_NAME_PREFIX} ${phone}`,
    phone_number: phone
  });
  // A API retorna o contato dentro de payload.contact (cria contact_inbox junto)
  return data?.payload?.contact || data?.payload || null;
}

async function getContactableInboxes(client, accountId, contactId) {
  const { data } = await client.get(
    `/accounts/${accountId}/contacts/${contactId}/contactable_inboxes`
  );
  return data?.payload || data || [];
}

/**
 * Garante que o contato tem um contact_inbox vinculado ao inbox informado.
 * Sem isso não é possível criar uma conversa nova nesse canal.
 */
async function ensureContactInbox(client, accountId, contactId, inboxId, phone) {
  const inboxes = await getContactableInboxes(client, accountId, contactId);
  const existing = inboxes.find(
    (i) => Number(i.inbox?.id ?? i.id) === Number(inboxId)
  );
  if (existing) return existing.source_id;

  const { data } = await client.post(
    `/accounts/${accountId}/contacts/${contactId}/contact_inboxes`,
    { inbox_id: inboxId, source_id: phone }
  );
  return data?.source_id || phone;
}

async function findOpenConversation(client, accountId, contactId, inboxId) {
  const { data } = await client.get(
    `/accounts/${accountId}/contacts/${contactId}/conversations`
  );
  const conversations = data?.payload || [];
  return (
    conversations.find(
      (c) =>
        Number(c.inbox_id) === Number(inboxId) &&
        ['open', 'pending', 'snoozed'].includes(c.status)
    ) || null
  );
}

async function createConversation(client, accountId, contactId, inboxId) {
  // Propositalmente sem "source_id": deixar o Chatwoot resolver a partir
  // do contact_inbox evita o erro relatado quando se envia um valor manual.
  const { data } = await client.post(`/accounts/${accountId}/conversations`, {
    contact_id: contactId,
    inbox_id: inboxId
  });
  return data;
}

async function sendMessage(client, accountId, conversationId, content, templateParams) {
  const payload = { message_type: 'outgoing' };

  if (content) payload.content = content;
  if (templateParams) payload.template_params = templateParams;

  const { data } = await client.post(
    `/accounts/${accountId}/conversations/${conversationId}/messages`,
    payload
  );
  return data;
}

app.post('/send-message', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({
      status: 'error',
      error:
        'Token ausente. Envie no header "api_access_token" (ou "Authorization: Bearer <token>").'
    });
  }

  const { account_id, inbox_id, phone, name, content, template_params } =
    req.body || {};

  if (!account_id || !inbox_id || !phone) {
    return res.status(400).json({
      status: 'error',
      error: 'Campos obrigatórios: account_id, inbox_id, phone.'
    });
  }
  if (!content && !template_params) {
    return res.status(400).json({
      status: 'error',
      error: 'Envie "content" (texto livre) e/ou "template_params" (template Meta).'
    });
  }
  if (template_params && !template_params.name) {
    return res.status(400).json({
      status: 'error',
      error: '"template_params.name" é obrigatório quando "template_params" é enviado.'
    });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ status: 'error', error: 'Telefone inválido.' });
  }

  const client = createClient(CHATWOOT_BASE_URL, token);

  try {
    // 1. Contato: busca por telefone, cria se não existir
    let contact = await findContactByPhone(client, account_id, normalizedPhone);
    if (!contact) {
      contact = await createContact(client, account_id, inbox_id, normalizedPhone, name);
    }
    if (!contact || !contact.id) {
      throw new Error('Não foi possível localizar ou criar o contato.');
    }

    // 2. Garante vínculo do contato com o inbox informado
    await ensureContactInbox(client, account_id, contact.id, inbox_id, normalizedPhone);

    // 3. Conversa: reaproveita uma aberta/pendente ou cria nova
    let conversation = await findOpenConversation(client, account_id, contact.id, inbox_id);
    if (!conversation) {
      conversation = await createConversation(client, account_id, contact.id, inbox_id);
    }
    if (!conversation || !conversation.id) {
      throw new Error('Não foi possível localizar ou criar a conversa.');
    }

    // 4. Envia texto simples e/ou template Meta
    const message = await sendMessage(
      client,
      account_id,
      conversation.id,
      content,
      template_params
    );

    return res.json({
      status: 'sent',
      conversation_id: conversation.id,
      contact_id: contact.id,
      message_id: message?.id || null
    });
  } catch (err) {
    const chatwootError = err?.response?.data;
    console.error('Erro ao processar envio:', chatwootError || err.message);
    return res.status(err?.response?.status || 500).json({
      status: 'error',
      error: chatwootError?.message || err.message || 'Erro desconhecido',
      details: chatwootError || null
    });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`chatwoot-quickstart rodando na porta ${PORT}`);
});
