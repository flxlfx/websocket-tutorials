import type { ServerWebSocket } from "bun";

type ClientData = {
  id: string;
};

// Guarda as conexões ativas
const clients = new Map<ServerWebSocket<ClientData>, string>();

// Variável compartilhada entre todos os clientes
let valor = 0;

const server = Bun.serve<ClientData>({
  port: 3000,
  hostname: "0.0.0.0",

  // Rota HTTP normal (pra testar no navegador)
  fetch(req, server) {
    // Tenta fazer upgrade para WebSocket
    if (server.upgrade(req, { data: { id: crypto.randomUUID() } })) {
      // Se o upgrade foi aceito, não retornamos Response
      return;
    }

    // Resposta HTTP padrão (se não for WS)
    return new Response(
      "Servidor WebSocket rodando. Conecte em ws://localhost:3000",
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

    // (opcional) tratar erro por conexão
    error(ws, error) {
      console.error("⚠️ Erro no WebSocket:", error);
    },
  },
});

console.log(`🚀 Servidor WebSocket escutando em ws://localhost:${server.port}`);
