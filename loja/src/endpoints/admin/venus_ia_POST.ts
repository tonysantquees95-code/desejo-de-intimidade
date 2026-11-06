import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { formatCents } from "../../helpers/formatCents";
import { isPromotion } from "../../helpers/pricing";
import { temIA, perguntarJson, buscarParecidos, sincronizarMemoria } from "../../helpers/venusIA";
import { schema, type OutputType, type VenusIAAcao } from "./venus_ia_POST.schema";

const PAGOS = ["paid", "preparing", "shipped", "delivered"] as const;
const TIPOS = new Set(["preco", "promocao", "fim_promocao", "estoque", "custo", "ativar", "desativar"]);

/**
 * Vênus da loja com IA, para pedidos da administradora que as regras não entendem:
 * análises ("o que vale colocar em promoção no Natal?") e mudanças em lote ("baixa 10% dos géis parados").
 * Vai para a IA só um retrato da loja (produtos, vendas por produto, totais) — nunca nome, telefone ou endereço de cliente.
 * As mudanças voltam como propostas: nada é salvo aqui; cada uma espera o "Confirmar" no painel.
 */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { pedido, conversa } = schema.parse(superjson.parse(await request.text()));
    if (!temIA()) {
      return new Response(superjson.stringify({ texto: "", acoes: [], disponivel: false } satisfies OutputType));
    }

    const produtos = await db
      .selectFrom("products")
      .select(["id", "name", "category", "active", "priceCents", "compareAtCents", "costCents", "stockQuantity"])
      .execute();

    const desde = new Date(Date.now() - 90 * 86_400_000);
    const vendas = await db
      .selectFrom("orderItems")
      .innerJoin("orders", "orders.id", "orderItems.orderId")
      .select(["orderItems.productId", "orderItems.quantity", "orderItems.unitPriceCents", "orders.createdAt"])
      .where("orders.status", "in", [...PAGOS])
      .where("orders.createdAt", ">=", desde)
      .execute();

    const porProduto = new Map<number, { qtd: number; receita: number; qtd30: number }>();
    const trintaDias = Date.now() - 30 * 86_400_000;
    let receita90 = 0;
    for (const v of vendas) {
      receita90 += v.unitPriceCents * v.quantity;
      if (v.productId === null) continue;
      const atual = porProduto.get(v.productId) ?? { qtd: 0, receita: 0, qtd30: 0 };
      atual.qtd += v.quantity;
      atual.receita += v.unitPriceCents * v.quantity;
      if (new Date(v.createdAt).getTime() >= trintaDias) atual.qtd30 += v.quantity;
      porProduto.set(v.productId, atual);
    }

    // produtos mais ligados ao pedido primeiro (memória vetorial), depois o resto, até 120
    let ordem = produtos.map((p) => p.id);
    try {
      await sincronizarMemoria();
      const parecidos = await buscarParecidos(pedido, 25, ["produto"]);
      const primeiro = parecidos.map((p) => Number(p.item.ref));
      ordem = [...primeiro, ...ordem.filter((id) => !primeiro.includes(id))];
    } catch {
      // sem vetores: segue a ordem normal
    }
    const linhas = ordem
      .map((id) => produtos.find((p) => p.id === id))
      .filter((p): p is (typeof produtos)[number] => Boolean(p))
      .slice(0, 120)
      .map((p) => {
        const v = porProduto.get(p.id);
        const margem =
          p.priceCents && p.costCents !== null ? `${Math.round(((p.priceCents - p.costCents) * 100) / p.priceCents)}%` : "sem custo";
        return [
          `#${p.id} ${p.name}`,
          p.category,
          p.active ? "no site" : "escondido",
          p.priceCents !== null ? `preço ${formatCents(p.priceCents)}` : "sem preço",
          isPromotion(p) && p.compareAtCents ? `em promoção (antes ${formatCents(p.compareAtCents)})` : "",
          p.costCents !== null ? `custo ${formatCents(p.costCents)}` : "",
          `margem ${margem}`,
          `estoque ${p.stockQuantity ?? "não controlado"}`,
          `vendeu ${v?.qtd ?? 0} em 90 dias (${v?.qtd30 ?? 0} em 30)`,
        ]
          .filter(Boolean)
          .join(" | ");
      });

    const historico = (conversa ?? []).map((m) => `${m.de === "eu" ? "Administradora" : "Vênus"}: ${m.texto}`).join("\n");
    const prompt =
      "Você é a Vênus da loja, assistente de gestão da Desejo de Intimidade (moda íntima e sex shop online, Porto Alegre, entrega discreta para todo o Brasil). " +
      "Fale com a administradora em português do Brasil, direto e prático, sem markdown, em até 8 frases. " +
      "Baseie números e recomendações SÓ nos dados abaixo; se faltar dado, diga qual. Faça as contas com cuidado (margem = (preço - custo) / preço). " +
      "Nunca proponha preço ou promoção abaixo do custo. " +
      "Se o pedido pedir mudanças nos produtos, proponha cada uma em \"acoes\" (no máximo 15): " +
      "tipo preco (valor = novo preço em centavos), promocao (valor = preço promocional em centavos, menor que o preço atual), fim_promocao (valor null), " +
      "estoque (valor = quantidade FINAL), custo (valor = custo em centavos), ativar ou desativar (valor null). " +
      "Use os números #id dos produtos. As ações só são aplicadas depois que ela confirmar, então explique no texto o que propôs e o efeito na margem. " +
      "Se for só pergunta ou análise, deixe \"acoes\" vazio.\n\n" +
      `Faturamento dos últimos 90 dias: ${formatCents(receita90)}.\n` +
      `Produtos (id | categoria | situação | preço | promoção | custo | margem | estoque | vendas):\n${linhas.join("\n")}\n\n` +
      (historico ? `Conversa até aqui:\n${historico}\n\n` : "") +
      `Pedido: ${pedido}\n\n` +
      'Responda só com JSON: {"texto":"...","acoes":[{"tipo":"promocao","produtoId":12,"valor":2490,"motivo":"..."}]}';

    const r = await perguntarJson(prompt, 40_000, 2048);
    if (!r || typeof r.texto !== "string") {
      return new Response(
        superjson.stringify({ texto: "A IA não respondeu agora. Tente de novo em instantes.", acoes: [], disponivel: true } satisfies OutputType),
      );
    }
    const acoes: VenusIAAcao[] = (Array.isArray(r.acoes) ? r.acoes : [])
      .map((a) => a as Record<string, unknown>)
      .filter((a) => TIPOS.has(String(a.tipo)))
      .map((a) => ({
        tipo: String(a.tipo) as VenusIAAcao["tipo"],
        produtoId: Number(a.produtoId),
        valor: a.valor === null || a.valor === undefined ? null : Math.round(Number(a.valor)),
        motivo: String(a.motivo ?? "").slice(0, 200),
      }))
      .filter((a) => {
        const p = produtos.find((x) => x.id === a.produtoId);
        if (!p) return false;
        if (["preco", "promocao", "estoque", "custo"].includes(a.tipo) && (a.valor === null || !Number.isFinite(a.valor) || a.valor < 0)) return false;
        if (a.tipo === "promocao" && (p.priceCents === null || a.valor! >= p.priceCents)) return false;
        if ((a.tipo === "preco" || a.tipo === "promocao") && p.costCents !== null && a.valor! < p.costCents) return false;
        return true;
      })
      .slice(0, 15);

    return new Response(superjson.stringify({ texto: r.texto.trim().slice(0, 2000), acoes, disponivel: true } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("venus ia admin", error);
    return new Response(superjson.stringify({ error: "Não consegui pensar nisso agora. Tente de novo." }), { status: 400 });
  }
}
