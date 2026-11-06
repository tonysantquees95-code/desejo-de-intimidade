import { db } from "./db";

/**
 * Regras de venda da loja (pagamento, frete, retirada, embalagem discreta, trocas, horário, idade), as mesmas
 * que o dono preenche na Vênus app (Ajustes → Site, ramo e regras de venda). O app manda para cá sempre que
 * elas mudam; a Vênus da Loja, o robô e o Direct do Instagram respondem com elas.
 */
export type RespostaDeRegra = { id: string; pergunta: string; resposta: string };
export type RegrasVenda = { regras: Record<string, unknown>; texto: string; respostas: RespostaDeRegra[]; quando: string };

const CHAVE = "regras_venda";
let cache: { valor: RegrasVenda | null; ate: number } | null = null;

export async function lerRegrasVenda(): Promise<RegrasVenda | null> {
  if (cache && cache.ate > Date.now()) return cache.valor;
  let valor: RegrasVenda | null = null;
  try {
    const linha = await db.selectFrom("siteSettings").select("value").where("key", "=", CHAVE).executeTakeFirst();
    if (linha?.value) {
      const v = JSON.parse(linha.value) as Partial<RegrasVenda>;
      valor = {
        regras: (v.regras ?? {}) as Record<string, unknown>,
        texto: typeof v.texto === "string" ? v.texto : "",
        respostas: Array.isArray(v.respostas) ? v.respostas.filter((r) => r && typeof r.resposta === "string" && r.resposta.trim()) : [],
        quando: v.quando ?? "",
      };
    }
  } catch {
    valor = null;
  }
  cache = { valor, ate: Date.now() + 60_000 };
  return valor;
}

export async function salvarRegrasVenda(regras: Record<string, unknown>, texto: string, respostas: RespostaDeRegra[]): Promise<void> {
  const value = JSON.stringify({ regras, texto, respostas, quando: new Date().toISOString() });
  await db
    .insertInto("siteSettings")
    .values({ key: CHAVE, value })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
    .execute();
  cache = null;
}

/** A resposta pronta de uma regra (pagamento, frete, frete_gratis, postagem, retirada, discreto, troca, horario, idade), ou null. */
export async function respostaDaRegra(id: string): Promise<string | null> {
  const r = await lerRegrasVenda();
  return r?.respostas.find((x) => x.id === id)?.resposta.trim() || null;
}