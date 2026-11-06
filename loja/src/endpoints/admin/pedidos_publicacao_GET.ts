import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./pedidos_publicacao_GET.schema";

/**
 * A Vênus do celular chama a cada 2 minutos. Resposta leve: só os pedidos pendentes, que já saem marcados
 * como "fazendo" (para não serem feitos duas vezes). Um "fazendo" parado há 15 min volta para a fila.
 */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const agora = String(Date.now());
    await db
      .insertInto("siteSettings")
      .values({ key: "publicacoes_app_visto", value: agora })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: agora }))
      .execute();
    await db
      .updateTable("publicacaoPedidos")
      .set({ estado: "pendente" })
      .where("estado", "=", "fazendo")
      .where("atualizado", "<", new Date(Date.now() - 15 * 60_000))
      .execute();
    const pedidos = await db
      .updateTable("publicacaoPedidos")
      .set({ estado: "fazendo", atualizado: new Date() })
      .where("estado", "=", "pendente")
      .where("criado", ">", sql<Date>`now() - interval '2 days'`)
      .returning(["id", "tipo", "turno", "ideiaRef", "ideiaTitulo", "quando", "legenda"])
      .execute();
    return new Response(superjson.stringify({ pedidos } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("pedidos publicacao GET", error);
    return new Response(superjson.stringify({ error: "Não consegui ler os pedidos." }), { status: 500 });
  }
}