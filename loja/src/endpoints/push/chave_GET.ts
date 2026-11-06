import { chavesVapid } from "../../../shims/floot-push";

/** Chave pública VAPID para o navegador se inscrever nos avisos (Cloudflare). */
export async function handle(_request: Request) {
  const { publica } = await chavesVapid();
  return new Response(JSON.stringify({ chave: publica }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
