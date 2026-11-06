/**
 * Worker da loja Desejo de Intimidade no Cloudflare.
 * - /_api/<caminho>  → src/endpoints/<caminho>_<GET|POST>.ts (mesmo contrato do Floot: handle(request))
 * - /_api/_arquivo   → recebe o PUT das fotos enviadas pelo painel (ver shims/floot-storage.ts)
 * - /_cdn/up/…       → serve essas fotos, guardadas no D1
 * - /sitemap.xml     → endpoints/sitemap_GET
 * - o resto          → arquivos do site (dist/), com a página do app para qualquer rota
 */
import superjson from "superjson";
import { jwtVerify } from "jose";
import { rotas } from "./rotas.gen";

type Env = {
  ASSETS: { fetch(r: Request): Promise<Response> };
  DB: {
    prepare(sql: string): {
      bind(...v: unknown[]): { run(): Promise<unknown>; all(): Promise<{ results?: Record<string, unknown>[] }> };
    };
    batch(s: unknown[]): Promise<unknown>;
  };
  JWT_SECRET?: string;
};

const PEDACO = 1_500_000;

function erro(status: number, mensagem: string) {
  return new Response(superjson.stringify({ error: mensagem }), { status, headers: { "content-type": "application/json" } });
}

async function receberArquivo(request: Request, env: Env): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "POST") return erro(405, "Use PUT.");
  const token = new URL(request.url).searchParams.get("t") ?? "";
  let dados: { caminho: string; tipo: string; tamanho: number };
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET ?? ""));
    dados = payload as never;
  } catch {
    return erro(403, "Endereço de envio vencido. Tente de novo.");
  }
  const corpo = new Uint8Array(await request.arrayBuffer());
  if (corpo.length === 0 || corpo.length > 8 * 1024 * 1024) return erro(400, "Arquivo vazio ou maior que 8 MB.");
  const comandos = [env.DB.prepare("DELETE FROM arquivos WHERE caminho = ?").bind(dados.caminho)];
  for (let i = 0, parte = 0; i < corpo.length; i += PEDACO, parte++) {
    comandos.push(
      env.DB.prepare("INSERT INTO arquivos (caminho, parte, tipo, dados) VALUES (?, ?, ?, ?)").bind(
        dados.caminho,
        parte,
        request.headers.get("content-type") || dados.tipo,
        corpo.subarray(i, i + PEDACO),
      ),
    );
  }
  await env.DB.batch(comandos);
  return new Response(null, { status: 200 });
}

async function servirArquivo(caminho: string, env: Env): Promise<Response> {
  const r = await env.DB.prepare("SELECT tipo, dados FROM arquivos WHERE caminho = ? ORDER BY parte").bind(caminho).all();
  const linhas = r.results ?? [];
  if (linhas.length === 0) return new Response("Não encontrado", { status: 404 });
  const partes = linhas.map((l) => new Uint8Array(l.dados as ArrayBuffer));
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) {
    total.set(p, i);
    i += p.length;
  }
  return new Response(total, {
    headers: { "content-type": String(linhas[0].tipo), "cache-control": "public, max-age=31536000, immutable" },
  });
}

async function chamarEndpoint(chave: string, request: Request): Promise<Response> {
  const mod = rotas[chave];
  if (!mod) return erro(404, "Endereço não encontrado.");
  try {
    return await mod.handle(request);
  } catch (e) {
    console.error(chave, e);
    return erro(500, "Erro no servidor.");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const caminho = url.pathname;
    if (caminho === "/_api/_arquivo") return receberArquivo(request, env);
    if (caminho.startsWith("/_api/")) {
      const metodo = request.method === "HEAD" ? "GET" : request.method;
      return chamarEndpoint(`${metodo} ${caminho.slice(6).replace(/\/+$/, "")}`, request);
    }
    if (caminho.startsWith("/_cdn/up/")) return servirArquivo(decodeURIComponent(caminho.slice(9)), env);
    if (caminho === "/sitemap.xml") return chamarEndpoint("GET sitemap", request);
    return env.ASSETS.fetch(request);
  },
};
