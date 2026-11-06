import { db } from "./db";

/**
 * Registro de ajustes do site: o que mudou de verdade (produto, preço, estoque, pedido, configurações, robô),
 * com data, hora e de onde veio (painel, Vênus da loja, app Vênus, robô). Serve para responder "o que mudou hoje?"
 * e para conferir ou desfazer algo à mão. Nunca atrapalha a ação: se não conseguir anotar, só avisa no log.
 */
export type Ajuste = { id: number; quando: Date; area: string; texto: string; origem: string; ok: boolean };

export const NOMES_AREA: Record<string, string> = {
  produto: "Produtos",
  estoque: "Estoque",
  pedido: "Pedidos",
  config: "Configurações",
  robo: "Robô",
  avaliacao: "Avaliações",
  story: "Stories",
};

/** De onde veio o pedido: a Vênus da loja manda x-venus-origem; o app Android aparece pelo navegador dele. */
export function origemDe(request: Request | null): string {
  if (!request) return "sistema";
  const marcada = request.headers.get("x-venus-origem");
  if (marcada === "venus") return "Vênus da loja";
  if (marcada === "app") return "app Vênus";
  const ua = request.headers.get("user-agent") ?? "";
  if (/okhttp|Dalvik/i.test(ua)) return "app Vênus";
  return "painel";
}

export async function anotarAjuste(request: Request | null, area: string, texto: string, origem?: string, ok = true): Promise<void> {
  try {
    await db
      .insertInto("ajustesLog")
      .values({ area, texto: texto.slice(0, 500), origem: origem ?? origemDe(request), ok })
      .execute();
  } catch (e) {
    console.warn("ajustes log", e);
  }
}

export const STATUS_PEDIDO: Record<string, string> = {
  awaiting_payment: "aguardando pagamento",
  paid: "pago",
  preparing: "em separação",
  shipped: "enviado",
  delivered: "entregue",
  canceled: "cancelado",
};

export function reais(centavos: number | null | undefined): string {
  return centavos === null || centavos === undefined ? "sem preço" : `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** Meia-noite de hoje em Brasília. */
export function inicioDeHoje(): Date {
  const d = new Date();
  d.setUTCHours(3, 0, 0, 0);
  if (d.getTime() > Date.now()) d.setTime(d.getTime() - 86_400_000);
  return d;
}

export async function ajustesDesde(desde: Date, limite = 300): Promise<Ajuste[]> {
  return db.selectFrom("ajustesLog").selectAll().where("quando", ">=", desde).orderBy("id", "desc").limit(limite).execute();
}

/** "o que mudou hoje" em uma frase. */
export function resumoAjustes(lista: Pick<Ajuste, "area" | "texto" | "ok">[], periodo = "hoje"): string {
  if (lista.length === 0) return `Nenhum ajuste ${periodo}.`;
  const porArea = new Map<string, number>();
  for (const a of lista) porArea.set(a.area, (porArea.get(a.area) ?? 0) + 1);
  const partes = [...porArea.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `${n} em ${(NOMES_AREA[a] ?? a).toLowerCase()}`)
    .join(", ");
  const falhas = lista.filter((a) => !a.ok).length;
  return `${lista.length} ${lista.length === 1 ? "ajuste" : "ajustes"} ${periodo} (${partes})${falhas ? `, ${falhas} com falha` : ""}. O último: ${lista[0].texto}`;
}