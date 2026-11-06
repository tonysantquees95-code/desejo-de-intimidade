/**
 * Substituto do @floot/push no Cloudflare: Web Push (RFC 8291, aes128gcm) com chaves VAPID próprias.
 * Inscrições nativas do app (fcmToken) vão pelo Firebase (helpers/firebasePush).
 * As chaves VAPID são geradas na primeira vez e guardadas no banco (site_settings "vapid_chaves");
 * o navegador pega a pública em /_api/push/chave.
 */
import { db } from "../src/helpers/db";
import { enviarAviso, firebaseConfigurado } from "../src/helpers/firebasePush";

type Assinatura = { endpoint?: string; keys?: { p256dh: string; auth: string }; fcmToken?: string; apnsToken?: string };
export type PushPayload = {
  title?: string; body?: string; url?: string; tag?: string; icon?: string; badgeCount?: number;
  urgency?: "very-low" | "low" | "normal" | "high"; ttl?: number; [k: string]: unknown;
};
export type PushResult = { success: boolean; gone?: boolean; error?: string };

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const juntar = (...partes: Uint8Array[]) => {
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, tamanho: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, k, tamanho * 8));
}

let cacheChaves: { publica: string; privada: string } | null = null;
/** Par de chaves VAPID da loja (cria e guarda na primeira vez). */
export async function chavesVapid(): Promise<{ publica: string; privada: string }> {
  if (cacheChaves) return cacheChaves;
  const ler = async () => {
    const l = await db.selectFrom("siteSettings").select("value").where("key", "=", "vapid_chaves").executeTakeFirst();
    return l ? (JSON.parse(l.value) as { publica: string; privada: string }) : null;
  };
  let c = await ler();
  if (!c) {
    const par = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", par.privateKey)) as JsonWebKey;
    const publica = b64u(new Uint8Array((await crypto.subtle.exportKey("raw", par.publicKey)) as ArrayBuffer));
    await db
      .insertInto("siteSettings")
      .values({ key: "vapid_chaves", value: JSON.stringify({ publica, privada: jwk.d }) })
      .onConflict((oc) => oc.column("key").doNothing())
      .execute();
    c = await ler();
  }
  cacheChaves = c!;
  return cacheChaves;
}

let chaveVapid: CryptoKey | null = null;
async function assinarVapid(audiencia: string): Promise<{ jwt: string; publica: string }> {
  const { publica, privada } = await chavesVapid();
  if (!chaveVapid) {
    const pub = deB64u(publica);
    chaveVapid = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", d: privada, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }
  const cab = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(enc.encode(JSON.stringify({ aud: audiencia, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:desejodeintimidade@gmail.com" })));
  const ass = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chaveVapid, enc.encode(`${cab}.${corpo}`));
  return { jwt: `${cab}.${corpo}.${b64u(ass)}`, publica };
}

async function cifrar(texto: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPub = deB64u(p256dh);
  const segredo = deB64u(auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const localPub = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(segredo, compartilhado, juntar(enc.encode("WebPush: info\0"), uaPub, localPub), 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const chave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chave, juntar(texto, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return juntar(sal, rs, new Uint8Array([localPub.length]), localPub, cifrado);
}

async function enviarWeb(a: Assinatura, payload: PushPayload): Promise<PushResult> {
  if (!a.endpoint || !a.keys?.p256dh || !a.keys?.auth) return { success: false, gone: true, error: "inscrição incompleta" };
  const url = new URL(a.endpoint);
  const { jwt, publica } = await assinarVapid(`${url.protocol}//${url.host}`);
  const corpo = await cifrar(enc.encode(JSON.stringify(payload)), a.keys.p256dh, a.keys.auth);
  const r = await fetch(a.endpoint, {
    method: "POST",
    headers: {
      TTL: String(payload.ttl ?? 4 * 3600),
      Urgency: payload.urgency ?? "normal",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${publica}`,
      ...(payload.tag ? { Topic: String(payload.tag).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "aviso" } : {}),
    },
    body: corpo,
  });
  if (r.ok) return { success: true };
  return { success: false, gone: r.status === 404 || r.status === 410, error: `HTTP ${r.status}` };
}

export async function sendPushNotifications(assinaturas: unknown[], payload: PushPayload): Promise<PushResult[]> {
  return Promise.all(
    assinaturas.map(async (x) => {
      const a = (x ?? {}) as Assinatura;
      try {
        if (a.fcmToken) {
          if (!firebaseConfigurado()) return { success: false, error: "Firebase não configurado" };
          const r = await enviarAviso([a.fcmToken], { titulo: payload.title ?? "", texto: payload.body ?? "", url: payload.url });
          return { success: r.enviados > 0, gone: r.removidos > 0 };
        }
        return await enviarWeb(a, payload);
      } catch (e) {
        console.warn("push:", (e as Error).message);
        return { success: false, error: (e as Error).message };
      }
    }),
  );
}
