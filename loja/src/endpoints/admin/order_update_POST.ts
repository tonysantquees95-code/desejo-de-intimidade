import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { releaseOrderStock } from "../../helpers/releaseOrderStock";
import { anotarAjuste, STATUS_PEDIDO } from "../../helpers/ajustesLog";
import { avisarPedidoEnviado } from "../../helpers/firebasePush";
import { schema, type OutputType } from "./order_update_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const current = await db
      .selectFrom("orders")
      .select("status")
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (input.status === "canceled") {
      if (current && ["paid", "preparing", "shipped"].includes(current.status)) {
        return new Response(
          superjson.stringify({
            error:
              "Para cancelar um pedido já pago, use o botão “Cancelar e estornar”. Ele devolve o valor ao cliente.",
          }),
          { status: 400 },
        );
      }
    }
    const result = await db
      .updateTable("orders")
      .set({
        status: input.status,
        trackingCode: input.trackingCode || null,
        updatedAt: sql`now()`,
      })
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (input.status === "canceled") {
      await releaseOrderStock(input.id);
    }
    if (result.numUpdatedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "Pedido não encontrado." }),
        { status: 404 },
      );
    }
    // Avisa o cliente no app quando o pedido passa a "Enviado".
    if (input.status === "shipped" && current?.status !== "shipped") {
      await avisarPedidoEnviado(input.id);
    }
    await anotarAjuste(
      request,
      "pedido",
      `Pedido #${input.id}: ${STATUS_PEDIDO[input.status] ?? input.status}${input.trackingCode ? ` (rastreio ${input.trackingCode})` : ""}`,
    );
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("order update error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível atualizar o pedido." }),
      { status: 400 },
    );
  }
}