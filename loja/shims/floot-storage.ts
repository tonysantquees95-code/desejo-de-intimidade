/**
 * Substituto do @floot/storage: os arquivos enviados pelo painel ficam no próprio D1 (tabela arquivos),
 * em pedaços, e são servidos pelo Worker em /_cdn/up/<caminho>. O "endereço de envio" é um PUT para
 * /_api/_arquivo assinado com o JWT_SECRET (vale 15 minutos).
 */
import { SignJWT } from "jose";

type Pedido = { visibility: "public" | "private"; filename: string; contentType: string; sizeBytes: number };
type Resultado =
  | { ok: true; presignedUrl: string; headers: Record<string, string>; url: string }
  | { ok: false; error: { message: string } };

export async function upload(p: Pedido): Promise<Resultado> {
  const segredo = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.JWT_SECRET;
  if (!segredo) return { ok: false, error: { message: "Servidor sem JWT_SECRET." } };
  if (p.sizeBytes > 8 * 1024 * 1024) return { ok: false, error: { message: "Arquivo maior que 8 MB." } };
  const caminho = p.filename.replace(/[^A-Za-z0-9._/-]/g, "_").replace(/^\/+/, "");
  const token = await new SignJWT({ caminho, tipo: p.contentType, tamanho: p.sizeBytes })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(segredo));
  return {
    ok: true,
    presignedUrl: `/_api/_arquivo?t=${encodeURIComponent(token)}`,
    headers: { "Content-Type": p.contentType },
    url: `/_cdn/up/${caminho}`,
  };
}
