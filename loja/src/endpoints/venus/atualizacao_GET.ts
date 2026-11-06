import type { OutputType } from "./atualizacao_GET.schema";

/** Para o app chamar sem login. */
export const flootPreviewPublic = true;

const REPO = "tonysantquees95-code/Sexta-feira-";

type Asset = { name: string; url: string; size: number; digest?: string | null };
type Release = { tag_name: string; body?: string | null; draft?: boolean; assets?: Asset[] };

function cabecalhos(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "Venus-Atualizacao",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN_ATUALIZACOES ?? ""}`,
  };
}

/** O texto da publicação, sem as linhas técnicas. */
function notas(corpo: string | null | undefined): string {
  return (corpo ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(co-authored-by|claude-session|baixe o arquivo)/i.test(l))
    .join("\n")
    .slice(0, 600);
}

/**
 * Lojistas que usam a Vênus não têm acesso ao repositório (que é privado). O site consulta o GitHub com um token
 * só de leitura e devolve a versão mais nova com um link temporário do APK. O app confere o SHA-256 antes de instalar,
 * e o Android confere a assinatura.
 */
export async function handle(request: Request) {
  try {
    if (!process.env.GITHUB_TOKEN_ATUALIZACOES) {
      return new Response(JSON.stringify({ error: "Canal de atualização ainda não configurado." }), { status: 503 });
    }
    const app = new URL(request.url).searchParams.get("app") === "robo" ? "robo" : "venus";
    let release: Release | undefined;
    let numero = 0;
    let apk: Asset | undefined;
    if (app === "venus") {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: cabecalhos() });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      release = (await r.json()) as Release;
      numero = Number(/^v?1\.(\d+)/.exec(release.tag_name ?? "")?.[1] ?? 0);
      apk = (release.assets ?? []).find((a) => a.name.toLowerCase() === "venus.apk");
    } else {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: cabecalhos() });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      for (const rel of (await r.json()) as Release[]) {
        const n = Number(/^robo-1\.(\d+)$/.exec(rel.tag_name ?? "")?.[1] ?? 0);
        const a = (rel.assets ?? []).find((x) => x.name.toLowerCase() === "venusrobo.apk");
        if (!rel.draft && n > numero && a) {
          numero = n;
          release = rel;
          apk = a;
        }
      }
    }
    if (!release || !apk || !numero) {
      return new Response(JSON.stringify({ error: "Nenhuma versão publicada." }), { status: 404 });
    }
    // o download do GitHub responde com um redirecionamento para um link assinado e temporário
    const d = await fetch(apk.url, { headers: { ...cabecalhos(), Accept: "application/octet-stream" }, redirect: "manual" });
    const url = d.headers.get("location");
    if (!url) throw new Error(`download sem link (${d.status})`);
    // ?baixar=1: link para mandar ao lojista na primeira instalação (abre o download direto)
    if (new URL(request.url).searchParams.get("baixar") === "1") {
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
    }
    const saida: OutputType = {
      numero,
      tag: release.tag_name,
      notas: notas(release.body),
      tamanho: apk.size,
      sha256: (apk.digest ?? "").toLowerCase().startsWith("sha256:") ? (apk.digest ?? "").slice(7).toLowerCase() : "",
      url,
    };
    return new Response(JSON.stringify(saida), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("venus atualizacao", error);
    return new Response(JSON.stringify({ error: "Não consegui consultar as versões agora." }), { status: 502 });
  }
}