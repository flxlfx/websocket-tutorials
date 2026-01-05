const SHORTCUT_URL = process.env.SHORTCUT_URL!;
const SENTRY_SECRET = process.env.SENTRY_SECRET!;
const SHORTCUT_TOKEN = process.env.SHORTCUT_API_TOKEN!;

Bun.serve({
  port: 3335,
  hostname: "0.0.0.0",

  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const signature = req.headers.get("sentry-hook-signature");
    const body = await req.text();

    // ⚠️ Validação mínima (não pule isso)
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    // TODO: validar assinatura HMAC (recomendado)
    const payload = JSON.parse(body);

    if (payload.action !== "created") {
      return new Response("Ignored", { status: 200 });
    }

    const feedback = payload.data;

    const shortcutPayload = {
      user: feedback.name,
      email: feedback.email,
      comments: feedback.comments,
      issue: feedback.issue?.title,
      project: payload.project?.slug,
      sentryUrl: feedback.issue?.url,
    };

    await fetch(SHORTCUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shortcutPayload),
    });

    return new Response("OK");
  },
});
