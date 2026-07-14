# chatwoot-quickstart

Serviço Node.js/Express que resolve, num único POST, o fluxo:

1. Busca o contato pelo telefone (ou cria, se não existir)
2. Garante o vínculo do contato com o inbox informado
3. Reaproveita uma conversa aberta/pendente ou cria uma nova
4. Envia a mensagem — texto livre, template Meta, ou os dois juntos

Retorna `conversation_id`, `contact_id` e `status`.

## Configuração

```bash
cp .env.example .env
```

Edite `.env`:

```
CHATWOOT_BASE_URL=https://app.seudominio.com
PORT=3000
DEFAULT_CONTACT_NAME_PREFIX=WhatsApp
```

O **token do Chatwoot não fica no `.env`** — ele é enviado pelo cliente a cada
requisição (no header `api_access_token`, ou `Authorization: Bearer <token>`)
e simplesmente repassado para a API do Chatwoot. Isso evita guardar
credenciais de conta dentro do serviço.

## Rodando localmente

```bash
npm install
npm start
```

## Endpoint

`POST /send-message`

### Headers

```
Content-Type: application/json
api_access_token: SEU_TOKEN_DO_CHATWOOT
```

### Body — apenas texto

```json
{
  "account_id": 1,
  "inbox_id": 1,
  "phone": "5511987654321",
  "name": "José da Silva",
  "content": "Olá, tudo bem?"
}
```

### Body — template Meta (com ou sem `content`)

```json
{
  "account_id": 1,
  "inbox_id": 1,
  "phone": "5511987654321",
  "name": "José da Silva",
  "content": "Olá {{1}}, seu pedido {{2}} foi confirmado",
  "template_params": {
    "name": "order_confirmation",
    "category": "UTILITY",
    "language": "pt_BR",
    "processed_params": {
      "body": { "1": "José", "2": "121212" },
      "header": { "media_url": "https://exemplo.com/imagem.jpg", "media_type": "image" }
    }
  }
}
```

`template_params` (e tudo dentro dele) é opcional. Se não vier, é enviada
mensagem de texto normal com `content`. Se vier, é enviado o template
aprovado na Meta — `content` nesse caso é usado só como preview/log da
mensagem dentro do Chatwoot.

Campo opcional adicional: `name` — nome do contato, usado **apenas na
criação** (se o contato já existir no Chatwoot, o nome atual dele não é
alterado). Se omitido e o contato precisar ser criado, usa
`DEFAULT_CONTACT_NAME_PREFIX + telefone`.

### Exemplo com curl

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "api_access_token: SEU_TOKEN" \
  -d '{
    "account_id": 1,
    "inbox_id": 1,
    "phone": "5511987654321",
    "name": "José da Silva",
    "content": "Olá {{1}}, seu pedido {{2}} foi confirmado",
    "template_params": {
      "name": "order_confirmation",
      "category": "UTILITY",
      "language": "pt_BR",
      "processed_params": { "body": { "1": "José", "2": "121212" } }
    }
  }'
```

### Resposta de sucesso

```json
{
  "status": "sent",
  "conversation_id": 42,
  "contact_id": 17,
  "message_id": 231
}
```

### Resposta de erro

```json
{
  "status": "error",
  "error": "descrição do problema",
  "details": { "...": "corpo de erro original retornado pelo Chatwoot, quando houver" }
}
```

## Deploy (Docker / EasyPanel)

```bash
docker build -t chatwoot-quickstart .
docker run -d \
  -p 3000:3000 \
  -e CHATWOOT_BASE_URL=https://app.seudominio.com \
  --name chatwoot-quickstart \
  chatwoot-quickstart
```

No EasyPanel: crie um serviço "App" a partir deste diretório/repositório,
aponte para o `Dockerfile`, defina `CHATWOOT_BASE_URL` como variável de
ambiente, exponha a porta `3000` e configure o domínio/proxy como preferir.
O `PORT` pode ser sobrescrito pela plataforma se necessário (o app lê
`process.env.PORT`).

## Observações importantes

- **`inbox_id` precisa ser um canal WhatsApp Cloud API (oficial)**. Templates
  Meta só funcionam nesse tipo de inbox no Chatwoot.
- O endpoint `contactable_inboxes` e a criação de `contact_inboxes` dependem
  da versão do Chatwoot/fork em uso. Se o seu fork (AstraChat) alterou essas
  rotas, ajuste `ensureContactInbox` em `src/server.js` de acordo.
- A criação da conversa é feita **sem `source_id`** propositalmente — em
  vários relatos da comunidade, enviar um `source_id` "chutado" faz a API
  aceitar a requisição mas o Chatwoot nunca repassa a mensagem de fato para
  o WhatsApp.
- Templates com componentes de header + botões combinados podem ter suporte
  parcial dependendo da versão do Chatwoot — teste o seu template específico
  antes de colocar em produção.
- O token nunca é persistido em disco/log; ele trafega só na memória da
  requisição.
