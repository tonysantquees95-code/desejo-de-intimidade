import { compare as compararBcrypt } from "bcryptjs";

/**
 * Senhas com PBKDF2-SHA256 (WebCrypto, rápido no Cloudflare). Formato: pbkdf2$iteracoes$sal$hash (base64).
 * Hashes antigos do bcrypt ($2…) continuam sendo aceitos.
 */
const ITERACOES = 20_000; // o plano grátis do Workers dá ~10 ms de CPU por pedido

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteracoes }, chave, 256);
  return new Uint8Array(bits);
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const h = await derivar(senha, sal, ITERACOES);
  return `pbkdf2$${ITERACOES}$${b64(sal)}$${b64(h)}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  if (guardado.startsWith("$2")) return compararBcrypt(senha, guardado);
  const [tipo, it, sal, hash] = guardado.split("$");
  if (tipo !== "pbkdf2" || !it || !sal || !hash) return false;
  const h = await derivar(senha, deB64(sal), parseInt(it, 10));
  const esperado = deB64(hash);
  if (h.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < h.length; i++) dif |= h[i] ^ esperado[i];
  return dif === 0;
}
