import { createHash, createHmac, timingSafeEqual, randomBytes } from "crypto";
import { db } from "./db";
import { venusAtendimento } from "./venusAtendimento";
import { atenderNoRobo, perguntarJson, type MensagemRobo } from "./venusIA";
import { respostaDaRegra } from "./regrasVenda";
import { avisarEquipe } from "./avisarEquipe";
import { anotarAjuste } from "./ajustesLog";

/**
 * Direct automático do Instagram da loja, pela API oficial da Meta (webhook).
 * Primeiro contato: boas-vindas com o link do site e respostas rápidas (frete, pagamento, envio, trocas, equipe).
 * Respostas padrão vêm das regras de venda da Vênus app; perguntas livres vão para a Vênus (IA com a memória da loja).
 * Quando alguém da loja responde pelo Instagram (eco que não foi a Vênus que mandou), ela fica 12 h em silêncio
 * com aquela cliente. Resposta a story usa o story do dia. Começa DESLIGADO (instagram_direct_ligado = "1" liga).
 */

export const SITE = "https://desejo-de-intimidade.floot.app";
const CANAL = "instagram_direct";
const PAUSA_HUMANO_MS = 12 * 3600_000;
const GUARDAR_DIAS = 14;
const VERSAO = "v23.0";

export type ConexaoInstagram = { token: string; contaId: string; usuario: string; quando: string };

async function ler(chave: string): Promise<string | null> {
  return (await db.selectFrom("siteSettings").select("value").where("key", "=", chave).executeTakeFirst())?.value ?? null;
}
async function gravar(chave: string, value: string): Promise<void> {
  await db.insertInto("siteSettings").values({ key: chave, value }).onConflict((oc) => oc.column("key").doUpdateSet({ value })).execute();
}

export async function salvarConexaoInstagram(c: Omit<ConexaoInstagram, "quando">): Promise<void> {
  await gravar("instagram_conexao", JSON.stringify({ ...c, quando: new Date().toISOString() }));
}

export async function conexaoInstagram(): Promise<ConexaoInstagram | null> {
  try {
    const v = await ler("instagram_conexao");
    return v ? (JSON.parse(v) as ConexaoInstagram) : null;
  } catch {
    return null;
  }
}

export async function directLigado(): Promise<boolean> {
  return (await ler("instagram_direct_ligado")) === "1";
}
export async function ligarDirect(ligado: boolean): Promise<void> {
  await gravar("instagram_direct_ligado", ligado ? "1" : "0");
}

/** Senha que a Meta manda ao conferir o webhook (criada uma vez; aparece em /admin/instagram para colar no painel da Meta). */
export async function tokenDeVerificacao(): Promise<string> {
  const atual = await ler("instagram_verify_token");
  if (atual) return atual;
  const novo = randomBytes(18).toString("base64url");
  await gravar("instagram_verify_token", novo);
  return novo;
}

/** Confere a assinatura X-Hub-Signature-256 (HMAC do corpo com o segredo do app da Meta). */
export function assinaturaValida(corpo: string, assinatura: string | null): boolean {
  // trim: a chave copiada pelo celular às vezes vem com espaço ou quebra de linha
  const segredo = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!segredo || !assinatura?.startsWith("sha256=")) return false;
  const esperado = Buffer.from("sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex"));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** ID do app "Vênus da loja" na Meta. */
export const APP_ID_META = "1832676821209927";

/**
 * Pergunta à Meta se a chave secreta guardada é a deste app (pedindo um token de app).
 * true = confere; false = a Meta recusou; null = sem chave ou sem resposta.
 */
export async function segredoConfere(): Promise<boolean | null> {
  const segredo = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!segredo) return null;
  try {
    const url = `https://graph.facebook.com/oauth/access_token?client_id=${APP_ID_META}&client_secret=${encodeURIComponent(segredo)}&grant_type=client_credentials`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (r.ok) return true;
    console.warn("instagram: a Meta recusou a chave secreta", r.status, (await r.text()).slice(0, 200));
    return false;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ envio
function base(token: string): string {
  // token do login do Instagram (IGAA...) usa graph.instagram.com; o do Facebook (EAA...), graph.facebook.com
  return token.startsWith("IG") ? `https://graph.instagram.com/${VERSAO}` : `https://graph.facebook.com/${VERSAO}`;
}

type Mensagem = { text: string; quick_replies?: { content_type: "text"; title: string; payload: string }[] } | { attachment: unknown };

async function enviar(c: ConexaoInstagram, para: string, mensagem: Mensagem): Promise<string | null> {
  const r = await fetch(`${base(c.token)}/${c.contaId || "me"}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
    body: JSON.stringify({ recipient: { id: para }, message: mensagem }),
  });
  const json = (await r.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string; code?: number } };
  if (!r.ok) {
    console.warn("instagram direct: envio falhou", r.status, JSON.stringify(json).slice(0, 300));
    return null;
  }
  return json.message_id ?? null;
}

export const RAPIDAS = [
  { title: "Tipos de frete", payload: "FRETE" },
  { title: "Formas de pagamento", payload: "PAGAMENTO" },
  { title: "Tipos de envio", payload: "ENVIO" },
  { title: "Troca e devolução", payload: "TROCA" },
  { title: "Falar com a equipe", payload: "EQUIPE" },
] as const;

const comRapidas = (text: string): Mensagem => ({
  text: text.slice(0, 990),
  quick_replies: RAPIDAS.map((r) => ({ content_type: "text" as const, title: r.title, payload: r.payload })),
});

/** As 4 perguntas que aparecem quando a cliente abre o Direct pela primeira vez (ice breakers). */
export const PERGUNTAS_FREQUENTES = [
  { question: "Quais as formas de pagamento?", payload: "PAGAMENTO" },
  { question: "Como funciona o frete?", payload: "FRETE" },
  { question: "A entrega é discreta?", payload: "ENVIO" },
  { question: "Quero ver os produtos", payload: "SITE" },
];

export async function aplicarPerguntasFrequentes(): Promise<string | null> {
  const c = await conexaoInstagram();
  if (!c) return "O Instagram ainda não foi conectado pela Vênus app.";
  const r = await fetch(`${base(c.token)}/${c.contaId || "me"}/messenger_profile?platform=instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
    body: JSON.stringify({ platform: "instagram", ice_breakers: [{ locale: "default", call_to_actions: PERGUNTAS_FREQUENTES }] }),
  });
  if (r.ok) return null;
  const erro = (await r.text()).slice(0, 300);
  console.warn("instagram ice breakers", r.status, erro);
  return `A Meta recusou (${r.status}). ${erro}`;
}

// ------------------------------------------------------------------ respostas
async function comoNaVenus(pergunta: string): Promise<string> {
  return (await venusAtendimento(pergunta, null)).texto;
}

async function respostaRapida(payload: string): Promise<{ texto: string; equipe: boolean }> {
  switch (payload) {
    case "FRETE": {
      const frete = (await respostaDaRegra("frete")) ?? (await comoNaVenus("como funciona o frete"));
      const gratis = await respostaDaRegra("frete_gratis");
      return { texto: [frete, gratis].filter(Boolean).join(" ") + " Se quiser, me mande seu CEP que eu calculo o valor e o prazo.", equipe: false };
    }
    case "PAGAMENTO":
      return { texto: (await respostaDaRegra("pagamento")) ?? (await comoNaVenus("formas de pagamento")), equipe: false };
    case "ENVIO": {
      const partes = [await respostaDaRegra("postagem"), await respostaDaRegra("discreto"), await respostaDaRegra("retirada")].filter(Boolean);
      return { texto: partes.length ? partes.join(" ") : await comoNaVenus("entrega discreta e retirada"), equipe: false };
    }
    case "TROCA":
      return { texto: (await respostaDaRegra("troca")) ?? (await comoNaVenus("troca e devolução")), equipe: false };
    case "SITE":
      return { texto: `Nossos produtos estão todos aqui, com preço e foto: ${SITE} 💗 Se quiser ajuda para escolher, é só me contar o que você procura.`, equipe: false };
    case "EQUIPE":
    default:
      return { texto: "Claro! Vou chamar a equipe da loja para te atender pessoalmente, só um instante 💗", equipe: true };
  }
}

const BOAS_VINDAS = `Oi! Eu sou a Vênus, assistente virtual da Desejo de Intimidade 💗 Dá uma olhada nos nossos produtos: ${SITE}\n\nSe tiver alguma dúvida, toque numa opção abaixo ou escreva sua pergunta.`;
const SAUDACAO = /^(oi+|ola+|bom dia|boa tarde|boa noite|e ai|opa|hey|oie+|tudo bem|tudo bom|menu|inicio)\b/;

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

type Guardada = MensagemRobo & { mid?: string };

function lerMensagens(bruto: unknown): Guardada[] {
  try {
    const v = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    return Array.isArray(v) ? (v as Guardada[]) : [];
  } catch {
    return [];
  }
}

/** Resposta a um story: usa o story do dia mais recente como assunto. */
async function respostaAoStory(mensagem: string): Promise<string | null> {
  const story = await db.selectFrom("storiesDia").select(["titulo", "texto", "pergunta"]).orderBy("id", "desc").executeTakeFirst();
  if (!story) return null;
  const r = await perguntarJson(
    "Você é a Vênus, atendente da Desejo de Intimidade (sex shop online, entrega discreta). Uma seguidora respondeu ao story de hoje. " +
      `Story: "${story.titulo}" — ${story.texto}${story.pergunta ? ` (enquete: ${story.pergunta})` : ""}. ` +
      `Resposta dela: "${mensagem}". Responda em 1 ou 2 frases curtas, simpáticas e discretas, sem palavras vulgares, convidando a ver o site ${SITE} ` +
      'quando fizer sentido. Responda só com JSON: {"texto":"..."}',
    8_000,
  );
  return typeof r?.texto === "string" && r.texto.trim() ? r.texto.trim().slice(0, 900) : null;
}

type Evento = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string }; reply_to?: { story?: { id?: string } } };
  postback?: { payload?: string; title?: string };
};

/** Trata um evento do webhook (mensagem, resposta rápida, eco). Nunca lança erro. */
export async function tratarEvento(e: Evento, contaDaLoja: string): Promise<void> {
  try {
    const c = await conexaoInstagram();
    if (!c) return;
    const loja = c.contaId || contaDaLoja;
    const eco = e.message?.is_echo === true || e.sender?.id === loja;
    const cliente = eco ? e.recipient?.id : e.sender?.id;
    if (!cliente) return;
    const remetente = createHash("sha256").update(`${CANAL}:${cliente}`).digest("hex").slice(0, 32);
    await db.deleteFrom("venusRobo").where("canal", "=", CANAL).where("atualizado", "<", new Date(Date.now() - GUARDAR_DIAS * 86_400_000)).execute();
    const linha = await db.selectFrom("venusRobo").selectAll().where("canal", "=", CANAL).where("remetente", "=", remetente).executeTakeFirst();
    const historico = lerMensagens(linha?.mensagens).slice(-12);

    // alguém da loja respondeu pelo Instagram: a Vênus fica 12 h quieta com essa cliente
    if (eco) {
      const foiAVenus = !!e.message?.mid && historico.some((m) => m.mid === e.message?.mid);
      if (!foiAVenus && linha) {
        await db.updateTable("venusRobo").set({ pausadoAte: new Date(Date.now() + PAUSA_HUMANO_MS), atualizado: new Date() }).where("id", "=", linha.id).execute();
      }
      return;
    }
    if (!(await directLigado())) return;
    if (linha?.pausadoAte && new Date(linha.pausadoAte).getTime() > Date.now()) return;

    const payload = e.message?.quick_reply?.payload ?? e.postback?.payload ?? null;
    const texto = (e.message?.text ?? e.postback?.title ?? "").trim();
    if (!payload && !texto) return;
    const t = normalizar(texto);
    let resposta: Mensagem;
    let equipe = false;
    let falado = "";

    if (payload) {
      const r = await respostaRapida(payload);
      equipe = r.equipe;
      falado = r.texto;
      resposta = equipe ? { text: r.texto } : comRapidas(r.texto);
    } else if (historico.length === 0 || (SAUDACAO.test(t) && t.split(" ").length <= 4)) {
      falado = BOAS_VINDAS;
      resposta = comRapidas(BOAS_VINDAS);
    } else if (e.message?.reply_to?.story) {
      falado = (await respostaAoStory(texto)) ?? "Que bom que você gostou do nosso story 💗 Se quiser ver os produtos, é só entrar no site: " + SITE;
      resposta = { text: falado };
    } else {
      const ia = await atenderNoRobo(texto, historico, "instagram");
      falado = ia?.texto ?? (await comoNaVenus(texto));
      equipe = ia?.chamarHumano ?? /nao sei responder sozinha/.test(normalizar(falado));
      if (equipe && !/equipe/.test(normalizar(falado))) falado += "\n\nVou chamar a equipe da loja para te responder pessoalmente, só um instante 💗";
      resposta = equipe ? { text: falado } : comRapidas(falado);
    }

    const mid = await enviar(c, cliente, resposta);
    const nova: Guardada[] = [
      ...historico,
      { de: "cliente" as const, texto: (texto || payload || "").slice(0, 600), quando: Date.now() },
      { de: "venus" as const, texto: falado.slice(0, 700), quando: Date.now(), ...(mid ? { mid } : {}) },
    ].slice(-12);
    const pausadoAte = equipe ? new Date(Date.now() + PAUSA_HUMANO_MS) : null;
    await db
      .insertInto("venusRobo")
      .values({ canal: CANAL, remetente, mensagens: JSON.stringify(nova), pausadoAte, menu: null, atendimentos: 1, atualizado: new Date() })
      .onConflict((oc) =>
        oc.columns(["canal", "remetente"]).doUpdateSet((eb) => ({
          mensagens: JSON.stringify(nova),
          pausadoAte,
          atendimentos: eb("venusRobo.atendimentos", "+", 1),
          atualizado: new Date(),
        })),
      )
      .execute();
    if (equipe) {
      await avisarEquipe({ titulo: "Cliente no Direct do Instagram", texto: `Pediu atendimento: "${(texto || payload || "").slice(0, 100)}"`, url: "/admin/instagram", tag: `direct-${remetente.slice(0, 8)}` });
      await anotarAjuste(null, "robo", `Cliente do Direct do Instagram passada para a loja: "${(texto || payload || "").slice(0, 120)}"`, "Direct");
    }
  } catch (error) {
    console.error("instagram direct", error);
  }
}

/** Conversas recentes do Direct para a página /admin/instagram (sem identificar a cliente). */
export async function conversasRecentes(limite = 20) {
  const linhas = await db
    .selectFrom("venusRobo")
    .select(["id", "mensagens", "pausadoAte", "atendimentos", "atualizado"])
    .where("canal", "=", CANAL)
    .orderBy("atualizado", "desc")
    .limit(limite)
    .execute();
  return linhas.map((l) => ({
    id: l.id,
    mensagens: lerMensagens(l.mensagens).map(({ de, texto, quando }) => ({ de, texto, quando })),
    pausada: !!l.pausadoAte && new Date(l.pausadoAte).getTime() > Date.now(),
    atendimentos: l.atendimentos,
    atualizado: l.atualizado,
  }));
}