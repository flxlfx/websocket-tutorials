import type { ServerWebSocket } from "bun";

type ClientData = {
  id: string;
};

type ShortcutAction = {
  action: string;
  entity_type: string;
  name: string;
  id: number;
  app_url: string;
};

type ShortcutWebhook = {
  actions?: ShortcutAction[];
};

// Guarda as conexões ativas
const clients = new Map<ServerWebSocket<ClientData>, string>();

// Variável compartilhada entre todos os clientes
let valor = 0;

// Variáveis de ambiente do Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Função para enviar mensagem ao Telegram
async function sendToTelegram(text: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("⚠️ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não configurados");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      console.error("Erro ao enviar para Telegram:", await response.text());
    }
  } catch (error) {
    console.error("Erro Telegram:", error);
  }
}

const server = Bun.serve<ClientData>({
  port: 3334,
  hostname: "0.0.0.0",

  // Rota HTTP normal (pra testar no navegador)
  async fetch(req, server) {
    const url = new URL(req.url);
    console.log("📥 Request recebido:", req.method, url.pathname);

    // Rota webhook do Shortcut
    if (url.pathname === "/webhook/shortcut" && req.method === "POST") {
      console.log(
        "🔴 WEBHOOK CHAMADO - Método:",
        req.method,
        "Path:",
        url.pathname
      );
      try {
        const body = (await req.json()) as ShortcutWebhook;
        console.log("Evento recebido:", JSON.stringify(body, null, 2));

        // Validação básica do Shortcut
        if (body.actions && body.actions.length > 0) {
          for (const action of body.actions) {
            // Verifica se é criação de story
            if (action.action === "create" && action.entity_type === "story") {
              const storyName = action.name;
              const storyId = action.id;
              const appUrl = action.app_url;

              const message = `⚡ **Nova Story Criada!**\n\n🆔 ID: ${storyId}\n📝 Nome: ${storyName}\n🔗 [Abrir no Shortcut](${appUrl})`;

              await sendToTelegram(message);
            }
          }
        }

        return new Response(JSON.stringify({ message: "Webhook processado" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Erro ao processar webhook:", e);
        return new Response("Invalid JSON", { status: 400 });
      }
    }

    // Tenta fazer upgrade para WebSocket
    if (server.upgrade(req, { data: { id: crypto.randomUUID() } })) {
      // Se o upgrade foi aceito, não retornamos Response
      return;
    }

    // Resposta HTTP padrão (se não for WS)
    return new Response(
      "Servidor WebSocket rodando. Conecte em ws://localhost:3334",
      { status: 200 }
    );
  },

  websocket: {
    // Quando um cliente conecta
    open(ws) {
      const id = ws.data.id;
      clients.set(ws, id);

      console.log(`🔌 Cliente conectado: ${id}`);
      ws.send(`👋 Bem-vindo! Seu id é ${id}`);
      ws.send(JSON.stringify({ type: "valor", valor }));
    },

    // Quando recebe mensagem de algum cliente
    message(ws, message) {
      const id = ws.data.id;

      // message pode ser string ou ArrayBuffer, tratamos os dois
      let text: string;
      if (typeof message === "string") {
        text = message;
      } else {
        text = new TextDecoder().decode(message);
      }

      // Tenta parsear como JSON para comandos
      try {
        const data = JSON.parse(text);

        if (data.type === "updateValor") {
          valor = data.valor;
          console.log(`📊 Valor atualizado para ${valor} por ${id}`);

          // Broadcast do novo valor para todos os clientes
          const payload = JSON.stringify({ type: "valor", valor });
          for (const [client] of clients.entries()) {
            client.send(payload);
          }
          return;
        }
      } catch {
        // Não é JSON, é mensagem normal
      }

      console.log(`💬 Mensagem de ${id}: ${text}`);

      // Broadcast simples para todos os clientes conectados
      for (const [client, clientId] of clients.entries()) {
        const payload =
          client === ws
            ? `🟢 Você (${id}) disse: ${text}`
            : `🔵 ${id} disse: ${text}`;

        client.send(payload);
      }
    },

    // Quando a conexão fecha
    close(ws, code, reason) {
      const id = ws.data.id;
      clients.delete(ws);
      console.log(
        `❌ Cliente desconectado: ${id} (code=${code}, reason=${reason})`
      );
    },
  },
});

console.log(`🚀 Servidor WebSocket escutando em ws://localhost:${server.port}`);
