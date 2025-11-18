# exemple-websocket

Servidor WebSocket com webhook para Shortcut → Telegram.

## Instalação

```bash
bun install
```

## Configuração

Configure as variáveis de ambiente:

```bash
export TELEGRAM_TOKEN=seu_token_do_bot
export TELEGRAM_CHAT_ID=seu_chat_id
```

## Execução

```bash
bun run dev
```

## Endpoints

- **WebSocket**: `ws://localhost:3334`
- **Webhook Shortcut**: `POST http://localhost:3334/webhook/shortcut`

Servidor escuta na porta 3334.
