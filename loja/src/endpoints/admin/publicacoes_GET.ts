import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType, PedidoDTO } from "./publicacoes_GET.schema";

/** Página Publicações (Natália no iPhone): stories de hoje, ideias de post da Vênus e os pedidos feitos à Vênus do celular. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    // "hoje" no horário de Brasília
    const agora = new Date();
    const hojeBR = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const inicio = new Date(agora.getTime() - ((hojeBR.getHours() * 60 + hojeBR.getMinutes()) * 60 + hojeBR.getSeconds()) * 1000);
    const [stories, ideias, pedidos, visto] = await Promise.all([
      db.selectFrom("storiesDia").selectAll().where("criado", ">=", inicio).orderBy("id", "desc").limit(6).execute(),
      db.selectFrom("publicacaoIdeias").select(["ref", "titulo", "data", "formato", "legenda"]).orderBy("data", "asc").limit(30).execute(),
      db
        .selectFrom("publicacaoPedidos")
        .select(["id", "tipo", "turno", "ideiaTitulo", "quando", "estado", "resultado", "imagemUrl", "pedidoPor", "criado"])
        .orderBy("id", "desc")
        .limit(15)
        .execute(),
      db.selectFrom("siteSettings").select("value").where("key", "=", "publicacoes_app_visto").executeTakeFirst(),
    ]);
    const saida: OutputType = {
      stories,
      ideias,
      pedidos: pedidos as PedidoDTO[],
      appVistoEm: visto?.value ? new Date(Number(visto.value)) : null,
    };
    return new Response(superjson.stringify(saida));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("admin publicacoes", error);
    return new Response(superjson.stringify({ error: "Não consegui ler as publicações." }), { status: 500 });
  }
}