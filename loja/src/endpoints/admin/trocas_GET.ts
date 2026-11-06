import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./trocas_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const solicitacoes = await db
      .selectFrom("solicitacoesTroca as s")
      .innerJoin("orders as o", "o.id", "s.orderId")
      .select([
        "s.id",
        "s.orderId",
        "s.tipo",
        "s.preferencia",
        "s.itens",
        "s.descricao",
        "s.estado",
        "s.resposta",
        "s.criado",
        "s.atualizado",
        "o.customerName",
        "o.customerPhone",
        "o.status as orderStatus",
        "o.updatedAt as orderUpdatedAt",
        "o.totalCents",
        "o.paymentMethod",
      ])
      .orderBy("s.id", "desc")
      .limit(200)
      .execute();
    return new Response(superjson.stringify({ solicitacoes } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin trocas error", error);
    return new Response(superjson.stringify({ error: "Não foi possível carregar as solicitações." }), { status: 500 });
  }
}