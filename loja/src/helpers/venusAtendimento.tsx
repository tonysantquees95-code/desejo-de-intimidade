import { db } from "./db";
import { loadShippingConfig } from "./loadShippingConfig";
import { calculateShipping } from "./calculateShipping";
import { regionFromCep } from "./regionFromCep";
import { shippingRegions } from "./shippingRegions";
import { productCategories } from "./productCategories";
import { formatCents } from "./formatCents";
import { orderStatusLabels } from "./orderDto";
import { atenderComIA } from "./venusIA";
import {
  isPromotion,
  pixPriceCents,
  PIX_DISCOUNT_PERCENT,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENT_CENTS,
} from "./pricing";
import type { OutputType, VenusProduto, VenusAcao } from "../endpoints/venus/chat_POST.schema";

/**
 * Atendente virtual da loja (a "irmã da Vênus"). Responde sozinha, sem IA externa:
 * entrega discreta, pagamento, frete pelo CEP, retirada, pedidos do próprio cliente,
 * busca de produtos e passagem para o WhatsApp da loja.
 * Só usa dados públicos da loja; pedidos aparecem apenas para o cliente logado, e só os dele.
 */
export async function venusAtendimento(
  mensagem: string,
  userId: number | null,
): Promise<OutputType> {
  const t = normalizar(mensagem);
  const whatsapp = await numeroWhatsapp();
  const falarComLoja = (texto: string): VenusAcao | null =>
    whatsapp
      ? { rotulo: "Falar no WhatsApp", url: `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}` }
      : null;
  const resposta = (texto: string, produtos: VenusProduto[] = [], acoes: (VenusAcao | null)[] = []): OutputType => ({
    texto,
    produtos,
    acoes: acoes.filter((a): a is VenusAcao => a !== null),
  });

  // ------------------------------------------------------------ conversa
  if (/^(oi|ola|ol[aá]|bom dia|boa tarde|boa noite|e ai|hey|opa|tudo bem)\b/.test(t) && t.split(" ").length <= 4) {
    return resposta(
      "Oi! Eu sou a Vênus, a atendente virtual da Desejo de Intimidade. Posso te ajudar a encontrar produtos, " +
        "calcular o frete pelo CEP, explicar a entrega discreta, as formas de pagamento ou ver os seus pedidos. Como posso ajudar?",
    );
  }
  if (/\b(obrigad[oa]|valeu|brigad[oa]|agradeco)\b/.test(t) && t.split(" ").length <= 5) {
    return resposta("Por nada! Se precisar de mais alguma coisa, é só chamar. 💗");
  }

  // ------------------------------------------------------------ pessoa de verdade
  if (/\b(atendente|humano|pessoa|alguem|whats|whatsapp|zap|falar com (a loja|voces|vcs|o dono|a dona)|telefone|contato)\b/.test(t)) {
    return resposta(
      "Claro! Pelo WhatsApp você fala direto com a loja, com toda a discrição.",
      [],
      [falarComLoja("Olá! Vim pelo atendimento do site da Desejo de Intimidade.")],
    );
  }

  // ------------------------------------------------------------ pedidos do cliente
  if (/\b(meu pedido|meus pedidos|rastreio|rastrear|rastreamento|codigo de rastreio|onde esta (o )?meu|status do pedido|chegou|ja foi enviado|ja enviaram|acompanhar)\b/.test(t)) {
    if (userId === null) {
      return resposta(
        "Para eu ver os seus pedidos, entre na sua conta. Lá em Minha conta também aparece cada etapa e o código de rastreio.",
        [],
        [{ rotulo: "Entrar na minha conta", url: "/login" }],
      );
    }
    const pedidos = await db
      .selectFrom("orders")
      .select(["id", "status", "trackingCode", "shippingService", "createdAt"])
      .where("userId", "=", userId)
      .orderBy("id", "desc")
      .limit(3)
      .execute();
    if (pedidos.length === 0) {
      return resposta("Não encontrei pedidos na sua conta ainda. Quer ajuda para escolher algum produto?");
    }
    const linhas = pedidos.map((p) => {
      const status = orderStatusLabels[p.status] ?? p.status;
      const rastreio = p.trackingCode ? ` · rastreio ${p.trackingCode}` : "";
      return `Pedido #${p.id}: ${status.toLowerCase()}${rastreio}`;
    });
    return resposta(
      `${linhas.join("\n")}\n\nToque no pedido para ver os detalhes.`,
      [],
      pedidos.map((p) => ({ rotulo: `Ver pedido #${p.id}`, url: `/pedido/${p.id}` })),
    );
  }

  // ------------------------------------------------------------ frete e prazo
  const cep = t.replace(/[^\d]/g, "").match(/\d{8}/)?.[0] ?? null;
  if (cep || /\b(frete|prazo|entrega|entregam|chega|demora|correios|sedex|pac|envio|enviam|mandam)\b/.test(t)) {
    if (/\b(discret|sigilo|embalagem|caixa|remetente|nota fiscal|ninguem (vai )?saber|identifica)\w*/.test(t)) {
      return discricao();
    }
    if (cep) {
      const regiao = regionFromCep(cep);
      if (!regiao) return resposta("Esse CEP não parece válido. Pode conferir os 8 números?");
      try {
        const config = await loadShippingConfig();
        const r = calculateShipping(config, "sedex", cep);
        const nomeRegiao = shippingRegions.find((x) => x.id === regiao)?.label ?? regiao;
        const retirada = config.pickup.enabled
          ? " Se você estiver em Porto Alegre, também dá para retirar sem custo em um ponto de retirada, com dia e horário agendados pelo WhatsApp depois da compra."
          : "";
        return resposta(
          `Para o CEP ${cep.slice(0, 5)}-${cep.slice(5)} (${nomeRegiao}), o envio fica em torno de ${formatCents(r.priceCents)}, ` +
            `com prazo de cerca de ${r.days} dias úteis. O valor exato, com SEDEX e PAC, aparece na página do produto ou no carrinho, antes de pagar.${retirada}`,
        );
      } catch {
        return resposta("Não consegui calcular agora. O frete aparece certinho na página do produto ou no carrinho, é só digitar o CEP.");
      }
    }
    return resposta(
      "O frete é calculado pelo seu CEP, com SEDEX e PAC dos Correios, e o valor e o prazo aparecem antes de você pagar. " +
        "Se quiser, me diga seu CEP que eu te dou uma estimativa. A entrega é 100% discreta, para todo o Brasil.",
    );
  }

  // ------------------------------------------------------------ discrição
  if (/\b(discret|sigilo|embalagem|caixa|remetente|nota fiscal|privacidade|ninguem (vai )?saber|identifica|vizinh|familia|portaria)\w*/.test(t)) {
    return discricao();
  }

  // ------------------------------------------------------------ retirada
  if (/\b(retirar|retirada|retiro|agendar|agendamento|buscar (na loja|pessoalmente)|loja fisica|endereco da loja|onde fica a loja|ponto de retirada)\b/.test(t)) {
    const config = await loadShippingConfig().catch(() => null);
    if (config?.pickup.enabled) {
      return resposta(
        "Dá para retirar sem custo de frete em um ponto de retirada em Porto Alegre. " +
          "Na hora de finalizar, escolha \"Retirar em ponto de retirada\". Depois da compra, é só agendar pelo WhatsApp: " +
          "a loja combina com você o local, o dia e o horário. A retirada só acontece com horário marcado.",
        [],
        [
          userId !== null ? { rotulo: "Ver meus pedidos", url: "/minha-conta" } : null,
          falarComLoja("Olá! Queria agendar a retirada do meu pedido."),
        ],
      );
    }
    return resposta(
      "No momento a loja trabalha só com envio pelos Correios, com entrega discreta. Se precisar combinar algo, fale com a gente.",
      [],
      [falarComLoja("Olá! Queria saber sobre retirada de pedido.")],
    );
  }

  // ------------------------------------------------------------ pagamento
  if (/\b(pagamento|pagar|pix|cartao|credito|debito|parcel|vezes|boleto|desconto)\w*/.test(t)) {
    const boleto = /\bboleto\b/.test(t) ? " Boleto não está disponível no momento." : "";
    return resposta(
      `Você pode pagar com Pix, com ${PIX_DISCOUNT_PERCENT}% de desconto nos produtos que não estão em promoção, ` +
        `ou com cartão de crédito em até ${MAX_INSTALLMENTS}x, com parcela mínima de ${formatCents(MIN_INSTALLMENT_CENTS)}. ` +
        `O pagamento é seguro, pela InfinitePay.${boleto}`,
    );
  }

  // ------------------------------------------------------------ outras dúvidas comuns
  if (/\b(maior de idade|menor de idade|18 anos|idade minima|menor)\b/.test(t)) {
    return resposta("A venda é exclusiva para maiores de 18 anos.");
  }
  if (/\b(troca|trocar|devolu|devolver|arrependi|reembolso|defeito|garantia|estorno)\w*/.test(t)) {
    return resposta(
      "Para trocas, devoluções ou algum problema com o produto, fale com a loja pelo WhatsApp que a gente resolve com você, com toda a discrição.",
      [],
      [falarComLoja("Olá! Preciso de ajuda com troca ou devolução de um pedido.")],
    );
  }
  if (/\b(seguro|confiavel|golpe|e confiavel|e seguro|meus dados)\b/.test(t)) {
    return resposta(
      "Pode comprar tranquila(o): o pagamento é processado pela InfinitePay, e seus dados são usados somente para a entrega, nunca compartilhados. " +
        "A embalagem é neutra e o remetente não revela o tipo de produto.",
    );
  }
  if (/\b(categorias|o que (voces )?vendem|quais produtos|o que tem|catalogo)\b/.test(t)) {
    return resposta(
      "Temos: " + productCategories.map((c) => c.title).join(", ") + ". Me conte o que você procura que eu te mostro as opções.",
      [],
      productCategories.slice(0, 4).map((c) => ({ rotulo: c.title, url: `/categoria/${c.slug}` })),
    );
  }

  // ------------------------------------------------------------ IA com a memória vetorial da loja
  // Produtos, sinônimos ("algo para apimentar a relação") e dúvidas que as regras não cobrem.
  // Se a IA não estiver disponível ou falhar, segue a busca por palavras de antes.
  const comIA = await atenderComIA(mensagem, whatsapp);
  if (comIA) return comIA;

  // ------------------------------------------------------------ produtos
  const promocao = /\b(promo|promocao|promocoes|oferta|ofertas|desconto|barato|baratos|liquida)\w*/.test(t);
  const encontrados = await buscarProdutos(t, promocao);
  if (encontrados.length > 0) {
    const intro = promocao
      ? "Estas são as promoções de agora:"
      : encontrados.length === 1
        ? "Encontrei este produto:"
        : "Encontrei estas opções para você:";
    return resposta(intro, encontrados, [falarComLoja("Olá! Tenho uma dúvida sobre um produto do site.")]);
  }

  // ------------------------------------------------------------ não sei
  return resposta(
    "Hmm, essa eu não sei responder sozinha. Posso te mostrar produtos (me diga o que procura), calcular o frete pelo CEP, " +
      "explicar a entrega discreta e o pagamento, ou te passar para a loja no WhatsApp.",
    [],
    [falarComLoja("Olá! Vim pelo atendimento do site e tenho uma dúvida.")],
  );

  function discricao(): OutputType {
    return resposta(
      "Sim, 100% discreta: enviamos em caixa lacrada, sem logo e sem nenhuma indicação do conteúdo. " +
        "Na etiqueta e na nota fiscal não aparece nada que revele o tipo de produto, e seus dados são usados só para a entrega.",
    );
  }
}

// ------------------------------------------------------------ apoio
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function numeroWhatsapp(): Promise<string> {
  const row = await db
    .selectFrom("siteSettings")
    .select("value")
    .where("key", "=", "whatsapp_number")
    .executeTakeFirst();
  return (row?.value ?? "").replace(/\D/g, "");
}

const PALAVRAS_VAZIAS = new Set(
  ("a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro por com sem que qual quais quero queria " +
    "gostaria procuro procurando tem tens voces vcs vc voce me mostra mostre algum alguma produto produtos sobre ver " +
    "preciso indicacao indica indique recomenda recomendacao bom boa melhor melhores tipo coisa algo isso esse essa ai la " +
    "eu meu minha sou estou to ta muito mais menos bem como onde quando quanto custa preco valor").split(" "),
);

/** Palavras que puxam uma categoria inteira. */
const SINONIMOS: Record<string, string> = {
  lubrificante: "geis_lubrificantes",
  lubrificantes: "geis_lubrificantes",
  gel: "geis_lubrificantes",
  geis: "geis_lubrificantes",
  oleo: "geis_lubrificantes",
  massagem: "geis_lubrificantes",
  excitante: "excitantes_retardantes",
  excitantes: "excitantes_retardantes",
  retardante: "excitantes_retardantes",
  retardantes: "excitantes_retardantes",
  afrodisiaco: "excitantes_retardantes",
  vibrador: "vibradores",
  vibradores: "vibradores",
  protese: "vibradores",
  estimulador: "vibradores",
  bullet: "vibradores",
  masturbador: "masturbadores",
  masturbadores: "masturbadores",
  anel: "masturbadores",
  fantasia: "fantasias_lingerie",
  fantasias: "fantasias_lingerie",
  lingerie: "fantasias_lingerie",
  lingeries: "fantasias_lingerie",
  plug: "acessorios_bdsm",
  algema: "acessorios_bdsm",
  algemas: "acessorios_bdsm",
  venda: "acessorios_bdsm",
  bdsm: "acessorios_bdsm",
  kit: "kits_casais",
  kits: "kits_casais",
  casal: "kits_casais",
  casais: "kits_casais",
  presente: "kits_casais",
  presentear: "kits_casais",
};

function raiz(p: string): string {
  for (const s of ["ores", "eres", "oes", "aes", "es", "s"]) {
    if (p.endsWith(s) && p.length - s.length >= 4) return p.slice(0, -s.length);
  }
  return p;
}

async function buscarProdutos(t: string, promocao: boolean): Promise<VenusProduto[]> {
  const produtos = await db
    .selectFrom("products")
    .select(["id", "name", "description", "specifications", "category", "priceCents", "compareAtCents", "imageUrl", "stockQuantity"])
    .where("active", "=", true)
    .execute();

  const palavras = t.split(" ").filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p));
  const categorias = new Set(palavras.map((p) => SINONIMOS[p]).filter(Boolean));

  const pontuados = produtos
    .map((p) => {
      const nome = normalizar(p.name);
      const texto = normalizar(`${p.description ?? ""} ${p.specifications ?? ""}`);
      let pontos = 0;
      for (const palavra of palavras) {
        const r = raiz(palavra);
        if (new RegExp(`\\b${r}`).test(nome)) pontos += 3;
        else if (new RegExp(`\\b${r}`).test(texto)) pontos += 1;
      }
      if (categorias.has(p.category)) pontos += 2;
      if (promocao && isPromotion(p)) pontos += 3;
      return { p, pontos };
    })
    .filter((x) => x.pontos > 0 && (!promocao || isPromotion(x.p) || palavras.length > 1))
    .sort((a, b) => b.pontos - a.pontos);

  return pontuados.slice(0, 4).map(({ p }) => ({
    id: p.id,
    nome: p.name,
    precoCents: p.priceCents,
    pixCents: p.priceCents !== null ? pixPriceCents(p.priceCents, isPromotion(p)) : null,
    imagem: p.imageUrl,
    esgotado: p.stockQuantity !== null && p.stockQuantity <= 0,
  }));
}
