import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { loadOrders } from "../../helpers/loadOrders";
import { syncOrderPayment } from "../../helpers/syncOrderPayment";
import { syncShipment } from "../../helpers/syncShipment";
import type { OutputType } from "./order_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return new Response(superjson.stringify({ error: "Pedido inválido." }), {
        status: 400,
      });
    }

    const owner = await db
      .selectFrom("orders")
      .select("userId")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!owner || (owner.userId !== user.id && user.role !== "admin")) {
      return new Response(
        superjson.stringify({ error: "Pedido não encontrado." }),
        { status: 404 },
      );
    }

    // Re-check the payment with Mercado Pago so the page updates even without webhook
    try {
      await syncOrderPayment(id);
    } catch (syncError) {
      console.error("order sync error", syncError);
    }
    try {
      await syncShipment(id);
    } catch (syncError) {
      console.error("shipment sync error", syncError);
    }

    const [order] = await loadOrders({ orderId: id });
    return new Response(superjson.stringify({ order } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("order get error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar o pedido." }),
      { status: 500 },
    );
  }
}