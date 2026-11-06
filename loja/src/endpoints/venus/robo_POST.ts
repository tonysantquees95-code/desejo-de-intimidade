import { createHash, timingSafeEqual } from "crypto";
import { db } from "../../helpers/db";
import { venusAtendimento } from "../../helpers/venusAtendimento";
import { atenderNoRobo, type MensagemRobo } from "../../helpers/venusIA";
import { formatCents } from "../../helpers/formatCents";
import { productCategories } from "../../helpers/productCategories";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { lerRegrasVenda, respostaDaRegra } from "../../helpers/regrasVenda";
import { PRAZO_RESPOSTA_TROCA, RE_PEDIDO_FEITO, RE_PEDIDO_MOTOBOY, RE_SOLICITACAO_TROCA } from "../../helpers/trocas";
import { schema, type OutputType } from "./robo_POST.schema";

/** Para testar pela prévia (a chave secreta continua obrigatória). */
export const flootPreviewPublic = true;

const PAUSA_HUMANO_MS = 12 * 3600_000;
const GUARDAR_DIAS = 7;
const SITE = "https://desejo-de-intimidade.tonysantquees95.workers.dev";
const PEDE_PESSOA = /\b(atendente|humano|pessoa de verdade|falar com (alguem|a dona|o dono|voces|vcs)|troca|trocar|defeito|reclama|atrasad|nao chegou|reembolso|estorno|devolu)/;

const MENU =
  "Oi! Eu sou a Vênus, assistente virtual da Desejo de Intimidade 💗 Como posso te ajudar? Responda com o número:\n" +
  "1 - Produtos e promoções\n2 - Frete e prazo de entrega\n3 - Formas de pagamento\n4 - Entrega discreta\n" +
  "5 - Retirada em Porto Alegre\n6 - Falar com a loja\n\nSe preferir, é só escrever sua dúvida.";
const RODAPE = "\n\nDigite 0 para voltar ao menu ou 6 para falar com a loja.";
const SAUDACAO = /^(oi+|ola+|bom dia|boa tarde|boa noite|e ai|opa|hey|oie+|tudo bem|tudo bom|menu|inicio|comecar)\b/;

type Menu = "principal" | "produtos";

const responder = (out: OutputType) => new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
const nada = () => responder({ replies: [] });

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/** A coluna JSONB pode voltar como lista ou como texto JSON (depende de como foi gravada). */
function lerMensagens(bruto: unknown): MensagemRobo[] {
  try {
    const v = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    return Array.isArray(v) ? (v as MensagemRobo[]) : [];
  } catch {
    return [];
  }
}

type Especial = { texto: string; humano: boolean };

/** Prazo de postagem das regras de venda (Vênus app), em dias úteis; 2 se não tiver. */
async function prazoPostagem(): Promise<number> {
  const r = await lerRegrasVenda();
  const frete = r?.regras?.frete as { prazo_postagem_dias?: unknown } | undefined;
  const n = Number(frete?.prazo_postagem_dias);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/** A cliente mandou a solicitação de troca/devolução que o site preparou: agradece, pede as provas e chama a equipe. */
async function respostaSolicitacao(id: number): Promise<Especial> {
  const s = await db.selectFrom("solicitacoesTroca").select(["id"]).where("id", "=", id).executeTakeFirst();
  if (!s) {
    return { texto: `Recebi sua mensagem sobre a troca/devolução 💖 Vou passar para a equipe conferir, e respondemos em até ${PRAZO_RESPOSTA_TROCA} por aqui.`, humano: true };
  }
  return {
    texto:
      `Recebemos sua solicitação nº ${s.id} 💖 Obrigada por avisar! Agora é só mandar aqui as fotos do produto e do problema e, se tiver, ` +
      `o vídeo da abertura da embalagem. Nossa equipe analisa e te responde em até ${PRAZO_RESPOSTA_TROCA} por aqui.`,
    humano: true,
  };
}

/** A cliente mandou a confirmação de compra que o site preparou ("Fiz o pedido #12 no site..."): responde conforme o pedido. */
async function respostaPedido(id: number): Promise<Especial> {
  const p = await db.selectFrom("orders").select(["id", "status", "deliveryMethod"]).where("id", "=", id).executeTakeFirst();
  if (!p) return { texto: "Recebi sua mensagem sobre o pedido 💖 Vou pedir para a equipe conferir, e já te respondemos por aqui.", humano: true };
  switch (p.status) {
    case "canceled":
      return { texto: `Vi aqui que o pedido #${p.id} está cancelado. Vou chamar a equipe para te ajudar, só um instante 💖`, humano: true };
    case "awaiting_payment":
      return {
        texto:
          `Recebemos seu pedido #${p.id} 💖 Ele ainda está aguardando a confirmação do pagamento. No Pix, ela costuma sair em poucos minutos ` +
          `e aparece na página do pedido no site. Assim que entrar, a gente separa tudo!`,
        humano: false,
      };
    case "shipped":
      return { texto: `Seu pedido #${p.id} já foi postado 📦 O código de rastreio está na página do pedido no site. Qualquer dúvida, é só chamar!`, humano: false };
    case "delivered":
      return { texto: `Vi aqui que o pedido #${p.id} já foi entregue 💖 Em que posso te ajudar?`, humano: false };
    default: {
      if (p.deliveryMethod === "pickup") {
        return {
          texto: `Recebemos seu pedido #${p.id} e o pagamento está confirmado ✅ Vou chamar a equipe para combinar com você o dia, o horário e o local da retirada, só um instante 💖`,
          humano: true,
        };
      }
      if (p.deliveryMethod === "motoboy") {
        return { texto: `Recebemos seu pedido #${p.id} e o pagamento está confirmado ✅ A equipe já vai confirmar a saída do entregador por aqui 💖`, humano: true };
      }
      const dias = await prazoPostagem();
      return {
        texto:
          `Oba! Recebemos seu pedido #${p.id} e o pagamento está confirmado ✅ Vamos postar em até ${dias} ${dias === 1 ? "dia útil" : "dias úteis"}, ` +
          `em embalagem discreta, e te mandamos o código de rastreio por aqui. Obrigada pela compra! 💖`,
        humano: false,
      };
    }
  }
}

/**
 * Robozinho da loja no WhatsApp e no Instagram (pelo app Vênus Robô no celular da loja).
 * Primeira mensagem: boas-vindas com menu de opções. Depois responde com a Vênus (memória vetorial + Gemini),
 * lembra a conversa de cada cliente por 7 dias, não responde em grupos e, quando o assunto é para uma pessoa
 * (troca, reclamação, atraso, "quero falar com alguém", opção 6), avisa que vai chamar a equipe, devolve humano=true
 * e fica 12 horas em silêncio com aquela cliente.
 */
export async function handle(request: Request) {
  try {
    // 1) chave secreta (cabeçalho x-venus-chave, colada no app Vênus Robô)
    const enviada = request.headers.get("x-venus-chave") ?? "";
    const salva = (await db.selectFrom("siteSettings").select("value").where("key", "=", "robo_chave").executeTakeFirst())?.value ?? "";
    const a = Buffer.from(enviada);
    const b = Buffer.from(salva);
    if (!salva || a.length !== b.length || !timingSafeEqual(a, b)) return new Response(JSON.stringify({ error: "chave inválida" }), { status: 401 });

    // interruptor geral (robo_ligado = "0" desliga o robô sem mexer no celular)
    const ligado = (await db.selectFrom("siteSettings").select("value").where("key", "=", "robo_ligado").executeTakeFirst())?.value;
    if (ligado === "0") return nada();

    const { messengerPackageName, query } = schema.parse(await request.json());
    if (query.isGroup) return nada();
    const mensagem = query.message.trim();
    if (!mensagem) return nada();
    const canal: "whatsapp" | "instagram" = (messengerPackageName ?? "").includes("instagram") ? "instagram" : "whatsapp";
    // a cliente é guardada só por um código (hash) do nome/número, nunca o nome em si
    const remetente = createHash("sha256").update(`${canal}:${query.sender}`).digest("hex").slice(0, 32);

    // 2) conversa guardada (e limpeza das antigas)
    await db.deleteFrom("venusRobo").where("atualizado", "<", new Date(Date.now() - GUARDAR_DIAS * 86_400_000)).execute();
    const linha = await db.selectFrom("venusRobo").selectAll().where("canal", "=", canal).where("remetente", "=", remetente).executeTakeFirst();
    const historico = lerMensagens(linha?.mensagens).slice(-12);
    if (linha?.pausadoAte && new Date(linha.pausadoAte).getTime() > Date.now() && !query.isTestMessage) return nada();

    // 3) resposta: menu de boas-vindas e opções, pessoa da loja, CEP, IA com contexto, ou as regras da Vênus do site
    const t = normalizar(mensagem);
    const numero = /^\s*\d{1,2}\s*[.)-]?\s*$/.test(mensagem) ? Number(mensagem.replace(/[^0-9]/g, "")) : null;
    let menu: Menu | null = (linha?.menu as Menu | null) ?? null;
    let texto = "";
    // mensagens prontas que o site manda a cliente enviar: solicitação de troca e confirmação de compra
    const solicitacao = RE_SOLICITACAO_TROCA.exec(t);
    const pedidoFeito = RE_PEDIDO_FEITO.exec(t);
    const especial: Especial | null = solicitacao
      ? await respostaSolicitacao(Number(solicitacao[1]))
      : pedidoFeito
        ? await respostaPedido(Number(pedidoFeito[1]))
        : RE_PEDIDO_MOTOBOY.test(t)
          ? { texto: "Recebemos seu pedido com entrega por motoboy ✅ A equipe confere o endereço e já confirma a saída do entregador por aqui 💖", humano: true }
          : null;
    let chamarHumano = especial ? especial.humano : PEDE_PESSOA.test(t) || (numero === 6 && menu !== "produtos");
    const comoNaVenus = async (pergunta: string) => {
      const r = await venusAtendimento(pergunta, null);
      const produtos = r.produtos.slice(0, 3).map((p) => `• ${p.nome}${p.precoCents !== null ? ` — ${formatCents(p.precoCents)}` : ""}: ${SITE}/produto/${p.id}`);
      return [r.texto, ...produtos].join("\n");
    };

    if (especial) {
      texto = especial.texto;
      menu = null;
    } else if (chamarHumano) {
      texto = "Claro! Vou chamar a equipe da loja para te atender pessoalmente, só um instante 💗";
      menu = null;
    } else if (numero === 0 || ((historico.length === 0 || t === "menu") && (SAUDACAO.test(t) || t.split(" ").length <= 3))) {
      // primeira mensagem (ou "menu", "0"): boas-vindas com as opções
      texto = MENU;
      menu = "principal";
    } else if (numero !== null && menu === "principal") {
      switch (numero) {
        case 1:
          texto =
            "Qual tipo você procura? Responda com o número:\n" +
            productCategories.map((c, i) => `${i + 1} - ${c.title}`).join("\n") +
            `\n${productCategories.length + 1} - Promoções de agora\n\nOu escreva o que você procura.` + RODAPE;
          menu = "produtos";
          break;
        case 2:
          texto = "Me mande o seu CEP (só os números) que eu calculo o frete e o prazo. A entrega é para todo o Brasil, sempre discreta." + RODAPE;
          menu = null;
          break;
        // 3, 4 e 5: as respostas das regras de venda da Vênus app; sem elas, as regras do site
        case 3:
          texto = ((await respostaDaRegra("pagamento")) ?? (await comoNaVenus("formas de pagamento"))) + RODAPE;
          break;
        case 4:
          texto = ((await respostaDaRegra("discreto")) ?? (await comoNaVenus("entrega discreta"))) + RODAPE;
          break;
        case 5:
          texto = ((await respostaDaRegra("retirada")) ?? (await comoNaVenus("retirada em porto alegre"))) + RODAPE;
          break;
        default:
          texto = "Não encontrei essa opção. " + MENU;
      }
    } else if (numero !== null && menu === "produtos") {
      const cat = productCategories[numero - 1];
      if (cat) {
        const lista = await db
          .selectFrom("products")
          .select(["id", "name", "priceCents"])
          .where("active", "=", true)
          .where("category", "=", cat.id as never)
          .orderBy("sortOrder")
          .limit(4)
          .execute();
        texto =
          `${cat.title}: ${SITE}/categoria/${cat.slug}` +
          (lista.length ? "\n" + lista.map((p) => `• ${p.name}${p.priceCents !== null ? ` — ${formatCents(p.priceCents)}` : ""}: ${SITE}/produto/${p.id}`).join("\n") : "") +
          "\n\nQuer que eu te ajude a escolher? É só me contar o que você procura." + RODAPE;
      } else if (numero === productCategories.length + 1) {
        texto = (await comoNaVenus("promoções")) + RODAPE;
      } else {
        texto = "Não encontrei essa opção. Responda com o número da lista ou escreva o que procura." + RODAPE;
      }
    } else if (/\b\d{5}-?\d{3}\b/.test(mensagem)) {
      // CEP: as regras da Vênus do site calculam frete e prazo
      texto = (await comoNaVenus(mensagem)) + RODAPE;
      menu = null;
    } else {
      const ia = await atenderNoRobo(mensagem, historico, canal);
      if (ia) {
        texto = ia.texto;
        chamarHumano = ia.chamarHumano;
      } else {
        texto = await comoNaVenus(mensagem);
      }
      // se nem a IA nem as regras resolveram, passa para a loja
      if (/nao sei responder sozinha/.test(normalizar(texto))) chamarHumano = true;
      if (chamarHumano && !/equipe/.test(normalizar(texto))) texto = `${texto}\n\nVou chamar a equipe da loja para te responder pessoalmente, só um instante 💗`;
      menu = null;
    }

    // 4) guarda a conversa
    const nova: MensagemRobo[] = [
      ...historico,
      { de: "cliente" as const, texto: mensagem.slice(0, 600), quando: Date.now() },
      { de: "venus" as const, texto: texto.slice(0, 700), quando: Date.now() },
    ].slice(-12);
    const pausadoAte = chamarHumano ? new Date(Date.now() + PAUSA_HUMANO_MS) : null;
    await db
      .insertInto("venusRobo")
      .values({ canal, remetente, mensagens: JSON.stringify(nova), pausadoAte, menu, atendimentos: 1, atualizado: new Date() })
      .onConflict((oc) =>
        oc.columns(["canal", "remetente"]).doUpdateSet((eb) => ({
          mensagens: JSON.stringify(nova),
          pausadoAte,
          menu,
          atendimentos: eb("venusRobo.atendimentos", "+", 1),
          atualizado: new Date(),
        })),
      )
      .execute();
    if (chamarHumano && !query.isTestMessage) {
      await anotarAjuste(null, "robo", `Cliente do ${canal === "whatsapp" ? "WhatsApp" : "Instagram"} passada para a loja: "${mensagem.slice(0, 120)}"`, "robô");
    }

    // 5) responde com um pequeno atraso, para parecer natural
    return responder({ replies: [{ message: texto, delay: 3, delayMax: 8 }], humano: chamarHumano });
  } catch (error) {
    console.error("venus robo", error);
    return nada();
  }
}