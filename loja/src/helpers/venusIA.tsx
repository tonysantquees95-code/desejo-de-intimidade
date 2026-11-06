import { createHash } from "crypto";
import { db } from "./db";
import { productCategories } from "./productCategories";
import { formatCents } from "./formatCents";
import { isPromotion, pixPriceCents, PIX_DISCOUNT_PERCENT, MAX_INSTALLMENTS, MIN_INSTALLMENT_CENTS } from "./pricing";
import type { OutputType, VenusProduto, VenusAcao } from "../endpoints/venus/chat_POST.schema";
import { lerRegrasVenda } from "./regrasVenda";

/**
 * O cérebro com IA da Vênus do site (só no servidor; as chaves nunca vão para o navegador).
 *
 * Mesma inteligência da Vênus app: Groq como principal (rápido e grátis), Cloudflare Workers AI como segunda
 * opção e o Gemini por último. Os vetores da memória continuam no Gemini (embeddings).
 *
 * Memória vetorial da loja: cada produto ativo e cada regra da loja (entrega discreta, pagamento, frete, retirada,
 * trocas, maioridade) vira um vetor (embedding do Gemini) guardado na tabela venus_vetores. Na pergunta da cliente,
 * a pergunta também vira vetor, a Vênus pega os itens mais parecidos (similaridade de cosseno) e o Gemini responde
 * usando só esses fatos. Se não souber, oferece o WhatsApp da loja em vez de inventar.
 * Nenhum dado pessoal de cliente vai para a IA.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODELOS_VETOR = ["gemini-embedding-2", "gemini-embedding-2-preview", "gemini-embedding-001"];
// gemini-2.5-flash não está mais disponível para chaves novas (o Google indica o gemini-3.8-flash)
const MODELOS_TEXTO = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"];
const DIMENSOES = 768;

export function temIA(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN));
}

function chave(): string {
  return process.env.GEMINI_API_KEY ?? "";
}

// ------------------------------------------------------------------ vetores
let modeloVetor = MODELOS_VETOR[0];

function normalizarVetor(v: number[]): number[] | null {
  let soma = 0;
  for (const x of v) soma += x * x;
  if (soma === 0) return null;
  const n = Math.sqrt(soma);
  return v.map((x) => x / n);
}

/** Vetores (comprimento 1) de vários textos, na mesma ordem; null se nenhum modelo respondeu. */
export async function gerarVetores(textos: string[]): Promise<{ modelo: string; vetores: number[][] } | null> {
  if (!temIA() || textos.length === 0) return null;
  const ordem = [modeloVetor, ...MODELOS_VETOR.filter((m) => m !== modeloVetor)];
  for (const modelo of ordem) {
    const saida: number[][] = [];
    let indisponivel = false;
    for (let i = 0; i < textos.length; i += 100) {
      const lote = textos.slice(i, i + 100);
      const r = await fetch(`${API}${modelo}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave() },
        body: JSON.stringify({
          requests: lote.map((t) => ({
            model: `models/${modelo}`,
            content: { parts: [{ text: t.slice(0, 2000) || "." }] },
            outputDimensionality: DIMENSOES,
            taskType: "SEMANTIC_SIMILARITY",
          })),
        }),
      }).catch(() => null);
      if (!r) return null;
      if (r.status === 404 || r.status === 400) {
        indisponivel = true;
        break;
      }
      if (!r.ok) return null;
      const json = (await r.json()) as { embeddings?: { values: number[] }[] };
      const lista = json.embeddings ?? [];
      if (lista.length !== lote.length) return null;
      for (const e of lista) {
        const v = normalizarVetor(e.values);
        if (!v) return null;
        saida.push(v);
      }
    }
    if (indisponivel) continue;
    modeloVetor = modelo;
    return { modelo: `${modelo}@${DIMENSOES}`, vetores: saida };
  }
  return null;
}

function cosseno(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ------------------------------------------------------------------ o que a loja sabe
type Documento = { tipo: string; ref: string; texto: string };

/** Regras fixas do site (o pagamento segue sempre o checkout de verdade). */
function regrasPadrao(): Documento[] {
  return [
    {
      tipo: "regra",
      ref: "discricao",
      texto:
        "Entrega discreta: caixa lacrada, sem logo e sem nenhuma indicação do conteúdo. Na etiqueta e na nota fiscal não aparece nada que revele o tipo de produto. Os dados são usados só para a entrega.",
    },
    {
      tipo: "regra",
      ref: "pagamento",
      texto: `Pagamento: Pix com ${PIX_DISCOUNT_PERCENT}% de desconto nos produtos fora de promoção, ou cartão de crédito em até ${MAX_INSTALLMENTS}x com parcela mínima de ${formatCents(MIN_INSTALLMENT_CENTS)}, pelo Mercado Pago. Não aceita boleto.`,
    },
    {
      tipo: "regra",
      ref: "frete",
      texto: "Frete: calculado pelo CEP, com SEDEX e PAC dos Correios, para todo o Brasil. O valor e o prazo aparecem na página do produto e no carrinho antes de pagar. A cliente pode informar o CEP no chat para uma estimativa. Frete grátis: nas compras a partir de R$ 180,00 para o Sul, Sudeste e Centro-Oeste, a loja paga até R$ 30,00 do PAC (se o frete passar disso, a cliente paga só a diferença). Para o Nordeste e o Norte o frete é pago normalmente.",
    },
    {
      tipo: "regra",
      ref: "retirada",
      texto: "Retirada: dá para retirar sem custo de frete em um ponto de retirada em Porto Alegre, com dia e horário agendados pelo WhatsApp depois da compra.",
    },
    {
      tipo: "regra",
      ref: "trocas",
      texto: "Trocas, devoluções e defeitos: a cliente fala com a loja pelo WhatsApp e a loja resolve com discrição.",
    },
    { tipo: "regra", ref: "idade", texto: "Venda exclusiva para maiores de 18 anos." },
    {
      tipo: "regra",
      ref: "seguranca",
      texto: "Segurança: pagamento processado pelo Mercado Pago; os dados da cliente são usados só para a entrega e nunca compartilhados.",
    },
  ];
}

/**
 * As regras da loja para a memória: as do site, trocadas pelas respostas que o dono preencheu na Vênus app
 * (frete, retirada, embalagem, trocas, horário, idade...). O pagamento fica o do checkout, que é o que vale na compra.
 */
async function regrasDaLoja(): Promise<Documento[]> {
  const padrao = regrasPadrao();
  const venda = await lerRegrasVenda();
  if (!venda || venda.respostas.length === 0) return padrao;
  const trocas: Record<string, string> = { discreto: "discricao", troca: "trocas" };
  const doApp = new Map(venda.respostas.filter((r) => r.id !== "pagamento").map((r) => [trocas[r.id] ?? r.id, r]));
  const lista = padrao.map((d) => {
    const r = doApp.get(d.ref);
    return r ? { ...d, texto: `${r.pergunta} ${r.resposta}`.trim() } : d;
  });
  for (const [ref, r] of doApp) if (!lista.some((d) => d.ref === ref)) lista.push({ tipo: "regra", ref, texto: `${r.pergunta} ${r.resposta}`.trim() });
  if (venda.texto) lista.push({ tipo: "regra", ref: "resumo_venda", texto: `Regras de venda da loja: ${venda.texto}`.slice(0, 1800) });
  return lista;
}

type ProdutoLoja = {
  id: number;
  name: string;
  description: string | null;
  specifications: string | null;
  category: string;
  priceCents: number | null;
  compareAtCents: number | null;
  imageUrl: string | null;
  stockQuantity: number | null;
};

async function produtosAtivos(): Promise<ProdutoLoja[]> {
  return db
    .selectFrom("products")
    .select(["id", "name", "description", "specifications", "category", "priceCents", "compareAtCents", "imageUrl", "stockQuantity"])
    .where("active", "=", true)
    .execute();
}

function nomeCategoria(c: string): string {
  const achada = (productCategories as unknown as { id?: string; slug?: string; title?: string }[]).find((x) => x.id === c || x.slug === c);
  return achada?.title ?? c.replace(/_/g, " ");
}

function textoDoProduto(p: ProdutoLoja): string {
  const promo = isPromotion(p);
  const preco =
    p.priceCents !== null
      ? `${formatCents(p.priceCents)}${promo && p.compareAtCents ? ` (promoção, antes ${formatCents(p.compareAtCents)})` : ""}, ${formatCents(pixPriceCents(p.priceCents, promo))} no Pix`
      : "preço sob consulta";
  const estoque = p.stockQuantity !== null && p.stockQuantity <= 0 ? "esgotado" : "disponível";
  return [
    `Produto: ${p.name}.`,
    `Categoria: ${nomeCategoria(p.category)}.`,
    `Preço: ${preco}.`,
    `Situação: ${estoque}.`,
    p.description ? `Descrição: ${p.description}` : "",
    p.specifications ? `Especificações: ${p.specifications}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1800);
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

// ------------------------------------------------------------------ índice (atualiza sozinho)
type Indexado = { tipo: string; ref: string; texto: string; vetor: number[] };
let cacheIndice: { modelo: string; itens: Indexado[]; quando: number } | null = null;
let ultimaSincronia = 0;

/**
 * Mantém a memória vetorial igual à loja: gera o vetor só do que mudou (produto novo, preço, descrição)
 * e apaga o que saiu. Roda no máximo a cada 5 minutos.
 */
export async function sincronizarMemoria(forcar = false): Promise<{ novos: number; removidos: number } | null> {
  if (!temIA()) return null;
  if (!forcar && Date.now() - ultimaSincronia < 5 * 60_000) return { novos: 0, removidos: 0 };
  ultimaSincronia = Date.now();
  const produtos = await produtosAtivos();
  const documentos: Documento[] = [
    ...(await regrasDaLoja()),
    ...produtos.map((p) => ({ tipo: "produto", ref: String(p.id), texto: textoDoProduto(p) })),
  ];
  const guardados = await db.selectFrom("venusVetores").select(["id", "tipo", "ref", "hash", "modelo"]).where("tipo", "in", ["produto", "regra"]).execute();
  const porChave = new Map(guardados.map((g) => [`${g.tipo}:${g.ref}`, g]));
  const modeloAtual = `${modeloVetor}@${DIMENSOES}`;
  const mudaram = documentos.filter((d) => {
    const g = porChave.get(`${d.tipo}:${d.ref}`);
    return !g || g.hash !== hash(d.texto) || g.modelo !== modeloAtual;
  });
  let novos = 0;
  if (mudaram.length > 0) {
    const r = await gerarVetores(mudaram.map((d) => d.texto));
    if (r) {
      for (let i = 0; i < mudaram.length; i++) {
        const d = mudaram[i];
        await db
          .insertInto("venusVetores")
          .values({ tipo: d.tipo, ref: d.ref, texto: d.texto, hash: hash(d.texto), modelo: r.modelo, vetor: JSON.stringify(r.vetores[i]) })
          .onConflict((oc) =>
            oc.columns(["tipo", "ref"]).doUpdateSet({ texto: d.texto, hash: hash(d.texto), modelo: r.modelo, vetor: JSON.stringify(r.vetores[i]), atualizado: new Date() }),
          )
          .execute();
        novos++;
      }
    }
  }
  const validas = new Set(documentos.map((d) => `${d.tipo}:${d.ref}`));
  const sobrando = guardados.filter((g) => !validas.has(`${g.tipo}:${g.ref}`)).map((g) => g.id);
  if (sobrando.length > 0) await db.deleteFrom("venusVetores").where("id", "in", sobrando).execute();
  if (novos > 0 || sobrando.length > 0) cacheIndice = null;
  return { novos, removidos: sobrando.length };
}

async function indice(): Promise<{ modelo: string; itens: Indexado[] }> {
  if (cacheIndice && Date.now() - cacheIndice.quando < 5 * 60_000) return cacheIndice;
  const linhas = await db.selectFrom("venusVetores").select(["tipo", "ref", "texto", "vetor", "modelo"]).execute();
  const modelo = `${modeloVetor}@${DIMENSOES}`;
  const itens = linhas
    .filter((l) => l.modelo === modelo)
    .map((l) => ({ tipo: l.tipo, ref: l.ref, texto: l.texto, vetor: (typeof l.vetor === "string" ? JSON.parse(l.vetor) : l.vetor) as number[] }));
  cacheIndice = { modelo, itens, quando: Date.now() };
  return cacheIndice;
}

/** Os itens da memória mais parecidos com o texto (similaridade de cosseno). */
export async function buscarParecidos(texto: string, quantos = 6, tipos?: string[]): Promise<{ item: Indexado; nota: number }[]> {
  const r = await gerarVetores([texto]);
  if (!r) return [];
  const { itens } = await indice();
  return itens
    .filter((i) => !tipos || tipos.includes(i.tipo))
    .map((item) => ({ item, nota: cosseno(r.vetores[0], item.vetor) }))
    .sort((a, b) => b.nota - a.nota)
    .slice(0, quantos);
}

// ------------------------------------------------------------------ Gemini (texto)
/**
 * Como pedir "pense pouco" a cada modelo: os antigos aceitam thinkingBudget, os Gemini 3 pedem thinkingLevel.
 * O primeiro jeito que um modelo aceitar fica lembrado (sem pensar, a resposta sai em 1 a 3 s em vez de 10 s).
 */
const AJUSTES = ["budget", "minimal", "low", "nenhum"] as const;
type Ajuste = (typeof AJUSTES)[number];
const ajusteDoModelo = new Map<string, number>();
/**
 * Modelos que estouraram a cota (429) ficam de lado até o Google liberar de novo (o tempo vem na resposta).
 * Fica no banco (site_settings ia_pausa_<modelo>), porque cada pedido pode rodar numa máquina diferente.
 */
async function modelosPausados(): Promise<Map<string, number>> {
  try {
    const linhas = await db.selectFrom("siteSettings").select(["key", "value"]).where("key", "like", "ia_pausa_%").execute();
    return new Map(linhas.map((l) => [l.key.slice("ia_pausa_".length), Number(l.value) || 0]));
  } catch {
    return new Map();
  }
}

async function pausarModelo(modelo: string, corpo: string): Promise<void> {
  // "Please retry in 12h50m21.2s" → até quando; sem tempo na resposta, 10 minutos
  const m = /(?:retry|try again) in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(corpo);
  const ms = m ? ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000 : 10 * 60_000;
  const ate = String(Date.now() + Math.max(60_000, ms));
  try {
    await db
      .insertInto("siteSettings")
      .values({ key: `ia_pausa_${modelo}`, value: ate })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: ate }))
      .execute();
  } catch {
    // sem banco: só não lembra
  }
}

function configDe(ajuste: Ajuste, pensar: number): Record<string, unknown> {
  const config: Record<string, unknown> = { temperature: 0.4, responseMimeType: "application/json" };
  if (ajuste === "budget") config.thinkingConfig = { thinkingBudget: pensar };
  else if (ajuste !== "nenhum") config.thinkingConfig = { thinkingLevel: pensar > 0 ? "low" : ajuste };
  return config;
}

/**
 * Pergunta à IA e devolve o JSON da resposta (ou null): Groq primeiro, depois Cloudflare, depois Gemini.
 * Teto total de [tempoMs] (padrão 10 s); depois disso o atendimento por regras responde.
 */
export async function perguntarJson(pedido: string, tempoMs = 10_000, pensar = 0): Promise<Record<string, unknown> | null> {
  if (!temIA()) return null;
  const prazo = Date.now() + tempoMs;
  const pausados = await modelosPausados();
  for (const p of PROVEDORES) {
    if (!p.chave() || !p.url()) continue;
    const r = await perguntarOpenAI(p, pedido, prazo, pausados, pensar);
    if (r) return r;
  }
  if (!chave()) return null;
  return perguntarGemini(pedido, prazo, pausados, pensar);
}

async function perguntarGemini(pedido: string, prazoGemini: number, pausados: Map<string, number>, pensar: number): Promise<Record<string, unknown> | null> {
  const livres = MODELOS_TEXTO.filter((m) => (pausados.get(m) ?? 0) <= Date.now());
  for (const modelo of livres) {
    const ultimo = modelo === livres[livres.length - 1];
    for (let a = ajusteDoModelo.get(modelo) ?? 0; a < AJUSTES.length; a++) {
      const restante = prazoGemini - Date.now();
      if (restante < 800) return null;
      const controle = new AbortController();
      // o último modelo da fila pode usar todo o tempo que sobrou
      const relogio = setTimeout(() => controle.abort(), ultimo ? restante : Math.min(7_000, restante));
      const comeco = Date.now();
      try {
        const r = await fetch(`${API}${modelo}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": chave() },
          signal: controle.signal,
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: pedido }] }], generationConfig: configDe(AJUSTES[a], pensar) }),
        });
        if (r.status === 400 && AJUSTES[a] !== "nenhum") {
          // este jeito de pedir "pense pouco" não é aceito: tenta o próximo e lembra
          ajusteDoModelo.set(modelo, a + 1);
          continue;
        }
        if (!r.ok) {
          const corpo = (await r.text()).slice(0, 700);
          if (r.status === 429) await pausarModelo(modelo, corpo);
          console.warn(`venus IA: ${modelo} respondeu ${r.status}: ${corpo}`);
          break; // 404, 429, 503: próximo modelo
        }
        ajusteDoModelo.set(modelo, a);
        console.log(`venus IA: ${modelo} (${AJUSTES[a]}) respondeu em ${Date.now() - comeco} ms`);
        const json = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const texto = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
        const inicio = texto.indexOf("{");
        const fim = texto.lastIndexOf("}");
        if (inicio < 0 || fim < inicio) break;
        return JSON.parse(texto.slice(inicio, fim + 1)) as Record<string, unknown>;
      } catch {
        console.warn(`venus IA: ${modelo} (${AJUSTES[a]}) não respondeu em ${Date.now() - comeco} ms`);
        break;
      } finally {
        clearTimeout(relogio);
      }
    }
  }
  return null;
}

type Provedor = { nome: string; chave: () => string | undefined; url: () => string | null; modelos: string[]; tempoPorModelo: number };

/** As IAs no formato OpenAI, na ordem em que são tentadas (iguais às da Vênus app). */
const PROVEDORES: Provedor[] = [
  {
    nome: "Groq",
    chave: () => process.env.GROQ_API_KEY,
    url: () => "https://api.groq.com/openai/v1/chat/completions",
    modelos: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"],
    tempoPorModelo: 5_000,
  },
  {
    nome: "Cloudflare",
    chave: () => process.env.CLOUDFLARE_API_TOKEN,
    url: () =>
      process.env.CLOUDFLARE_ACCOUNT_ID
        ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`
        : null,
    modelos: ["@cf/openai/gpt-oss-120b", "@cf/openai/gpt-oss-20b", "@cf/qwen/qwen3-30b-a3b-fp8"],
    tempoPorModelo: 6_000,
  },
];

/** Jeito de pedir que cada modelo aceitou (alguns recusam response_format ou reasoning_effort). */
const simplesDoModelo = new Set<string>();

/** Pergunta a um provedor no formato OpenAI; passa para o próximo modelo em cota estourada (429) ou erro. */
async function perguntarOpenAI(
  p: Provedor,
  pedido: string,
  prazo: number,
  pausados: Map<string, number>,
  pensar: number,
): Promise<Record<string, unknown> | null> {
  for (const modelo of p.modelos) {
    if ((pausados.get(modelo) ?? 0) > Date.now()) continue;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const restante = prazo - Date.now();
      if (restante < 800) return null;
      const simples = simplesDoModelo.has(modelo) || tentativa === 1;
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), Math.min(p.tempoPorModelo, restante));
      const comeco = Date.now();
      try {
        const corpo: Record<string, unknown> = { model: modelo, temperature: 0.4, messages: [{ role: "user", content: pedido }] };
        if (!simples) {
          corpo.response_format = { type: "json_object" };
          if (modelo.includes("gpt-oss")) corpo.reasoning_effort = pensar > 0 ? "medium" : "low";
        }
        const r = await fetch(p.url()!, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.chave()}` },
          signal: controle.signal,
          body: JSON.stringify(corpo),
        });
        if (!r.ok) {
          const erro = (await r.text()).slice(0, 400);
          console.warn(`venus IA ${p.nome}: ${modelo} respondeu ${r.status}: ${erro}`);
          if (r.status === 400 && !simples) {
            simplesDoModelo.add(modelo);
            continue; // tenta de novo sem response_format
          }
          if (r.status === 429) await pausarModelo(modelo, erro);
          break; // próximo modelo
        }
        const json = (await r.json()) as { choices?: { message?: { content?: string | null } }[] };
        const texto = (json.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
        const inicio = texto.indexOf("{");
        const fim = texto.lastIndexOf("}");
        if (inicio < 0 || fim < inicio) break;
        console.log(`venus IA ${p.nome}: ${modelo} respondeu em ${Date.now() - comeco} ms`);
        return JSON.parse(texto.slice(inicio, fim + 1)) as Record<string, unknown>;
      } catch {
        console.warn(`venus IA ${p.nome}: ${modelo} não respondeu em ${Date.now() - comeco} ms`);
        break;
      } finally {
        clearTimeout(relogio);
      }
    }
  }
  return null;
}

/** Tira do texto as marcas internas como "[28]" ou "[produto 28]". */
function semMarcas(t: string): string {
  return t.replace(/\s*\[(?:produto\s*)?\d+\]/gi, "").replace(/\s{2,}/g, " ").trim();
}

// ------------------------------------------------------------------ atendimento da cliente
/**
 * Responde a cliente com IA e a memória vetorial da loja. Null se a IA não estiver disponível ou falhar
 * (aí o atendimento por regras continua respondendo).
 */
export async function atenderComIA(mensagem: string, whatsapp: string): Promise<OutputType | null> {
  if (!temIA()) return null;
  try {
    await sincronizarMemoria();
    const parecidos = await buscarParecidos(mensagem, 8);
    if (parecidos.length === 0) return null;
    const produtosIds = parecidos.filter((p) => p.item.tipo === "produto" && p.nota >= 0.55).map((p) => Number(p.item.ref));
    const contexto = parecidos
      .filter((p) => p.nota >= 0.5)
      .map((p) => (p.item.tipo === "produto" ? `[produto ${p.item.ref}] ${p.item.texto}` : `[regra] ${p.item.texto}`))
      .join("\n");
    const pedido =
      "Você é a Vênus, atendente virtual da Desejo de Intimidade, loja online de moda íntima e sex shop com entrega discreta. " +
      "Responda em português do Brasil, com carinho, discrição e elegância, sem palavras vulgares, em até 4 frases curtas. " +
      "Use SOMENTE os fatos abaixo; não invente produtos, preços, prazos ou políticas. Se a pergunta não puder ser respondida com eles, " +
      "diga que vai chamar a loja e marque whatsapp=true. Para sugerir produtos, coloque os números deles (entre colchetes nos fatos) só em \"produtos\", nunca no texto. " +
      "Nunca peça dados pessoais no chat.\n\n" +
      `Fatos da loja:\n${contexto || "(nenhum fato parecido)"}\n\n` +
      `Mensagem da cliente: ${mensagem}\n\n` +
      'Responda só com JSON: {"texto":"...","produtos":[números dos produtos indicados, no máximo 4],"whatsapp":false}';
    // no site a cliente está esperando na tela: até 7 s; depois disso as regras respondem na hora
    const r = await perguntarJson(pedido, 7_000);
    if (!r || typeof r.texto !== "string" || !r.texto.trim()) return null;
    const indicados = (Array.isArray(r.produtos) ? r.produtos : [])
      .map((x) => Number(x))
      .filter((id) => Number.isFinite(id) && produtosIds.includes(id))
      .slice(0, 4);
    const produtos = indicados.length > 0 ? await cartoes(indicados) : [];
    const acoes: VenusAcao[] = [];
    if (r.whatsapp === true && whatsapp) {
      acoes.push({ rotulo: "Falar no WhatsApp", url: `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Vim pelo atendimento do site da Desejo de Intimidade.")}` });
    }
    return { texto: semMarcas(r.texto).slice(0, 900), produtos, acoes };
  } catch (e) {
    console.error("venus IA", e);
    return null;
  }
}

async function cartoes(ids: number[]): Promise<VenusProduto[]> {
  const lista = await db
    .selectFrom("products")
    .select(["id", "name", "priceCents", "compareAtCents", "imageUrl", "stockQuantity"])
    .where("id", "in", ids)
    .where("active", "=", true)
    .execute();
  return ids
    .map((id) => lista.find((p) => p.id === id))
    .filter((p): p is (typeof lista)[number] => Boolean(p))
    .map((p) => ({
      id: p.id,
      nome: p.name,
      precoCents: p.priceCents,
      pixCents: p.priceCents !== null ? pixPriceCents(p.priceCents, isPromotion(p)) : null,
      imagem: p.imageUrl,
      esgotado: p.stockQuantity !== null && p.stockQuantity <= 0,
    }));
}

// ------------------------------------------------------------------ robozinho (WhatsApp e Instagram pelo app Vênus Robô)
export type MensagemRobo = { de: "cliente" | "venus"; texto: string; quando: number };

/**
 * Resposta curta, no jeito de WhatsApp/Instagram, com a conversa da cliente como contexto.
 * Devolve o texto e se deve passar para uma pessoa da loja. Null se a IA falhar (aí as regras respondem).
 */
export async function atenderNoRobo(
  mensagem: string,
  historico: MensagemRobo[],
  canal: "whatsapp" | "instagram",
): Promise<{ texto: string; chamarHumano: boolean } | null> {
  if (!temIA()) return null;
  try {
    await sincronizarMemoria();
    // a busca usa a mensagem e a anterior da cliente (para "e esse?", "quanto custa?")
    const anterior = [...historico].reverse().find((m) => m.de === "cliente")?.texto ?? "";
    const parecidos = await buscarParecidos(`${anterior} ${mensagem}`.trim(), 8);
    const site = "https://desejo-de-intimidade.floot.app";
    const contexto = parecidos
      .filter((p) => p.nota >= 0.5)
      .map((p) => (p.item.tipo === "produto" ? `[produto | link ${site}/produto/${p.item.ref}] ${p.item.texto}` : `[regra] ${p.item.texto}`))
      .join("\n");
    const conversa = historico
      .slice(-8)
      .map((m) => `${m.de === "cliente" ? "Cliente" : "Vênus"}: ${m.texto}`)
      .join("\n");
    const pedido =
      `Você é a Vênus, atendente virtual da Desejo de Intimidade (moda íntima e sex shop online, entrega discreta para todo o Brasil, ` +
      `retirada em Porto Alegre). Está respondendo no ${canal === "whatsapp" ? "WhatsApp" : "direct do Instagram"} da loja. ` +
      "Escreva como uma pessoa simpática e discreta escreve no celular: curto (1 a 3 frases), no máximo 1 emoji, sem markdown, sem palavras vulgares. " +
      "Use SOMENTE os fatos abaixo; não invente produtos, preços, prazos nem políticas. Quando indicar produto, mande o link dele. " +
      "Para comprar, mande o link do produto ou do site. Nunca peça CPF, endereço ou dados de cartão na conversa. " +
      "Marque chamarHumano=true quando: a cliente pedir para falar com alguém; for troca, defeito, reclamação, pedido atrasado ou problema com pagamento; " +
      "ou você não tiver a informação. Nesses casos, diga que vai chamar a equipe da loja.\n\n" +
      `Fatos da loja:\n${contexto || "(nenhum fato parecido)"}\n\n` +
      (conversa ? `Conversa até aqui:\n${conversa}\n\n` : "") +
      `Nova mensagem da cliente: ${mensagem}\n\n` +
      'Responda só com JSON: {"texto":"...","chamarHumano":false}';
    const r = await perguntarJson(pedido, 9_000);
    if (!r || typeof r.texto !== "string" || !r.texto.trim()) return null;
    return { texto: semMarcas(r.texto).slice(0, 700), chamarHumano: r.chamarHumano === true };
  } catch (e) {
    console.error("venus robo IA", e);
    return null;
  }
}
