import { createHash, timingSafeEqual } from "crypto";
import { db } from "../../helpers/db";

/**
 * TEMPORÁRIO (mudança do Floot): recebe do site antigo as configurações secretas (conexão do Instagram,
 * token de verificação do webhook e chave do robô) sem que passem pelo chat nem pelos registros.
 * Protegido por uma chave de uso único (só o hash fica aqui) e vale só até 08/11/2026. Será removido.
 */
const HASH = "ed70a264b28a367788fec324975051b99e854bb2b4b638b2d23f5111e67e5ee6";
const PERMITIDAS = new Set(["instagram_conexao", "instagram_verify_token", "robo_chave"]);

export async function handle(request: Request) {
  if (Date.now() > Date.parse("2026-11-08T00:00:00Z")) return new Response("{}", { status: 410 });
  const corpo = (await request.json().catch(() => ({}))) as { chave?: string; valores?: Record<string, string> };
  const h = createHash("sha256").update(String(corpo.chave ?? "")).digest();
  if (!timingSafeEqual(h, Buffer.from(HASH, "hex"))) return new Response("{}", { status: 403 });
  const gravadas: string[] = [];
  for (const [key, value] of Object.entries(corpo.valores ?? {})) {
    if (!PERMITIDAS.has(key) || typeof value !== "string" || !value) continue;
    await db.insertInto("siteSettings").values({ key, value }).onConflict((oc) => oc.column("key").doUpdateSet({ value })).execute();
    gravadas.push(key);
  }
  return new Response(JSON.stringify({ gravadas }), { headers: { "content-type": "application/json" } });
}
