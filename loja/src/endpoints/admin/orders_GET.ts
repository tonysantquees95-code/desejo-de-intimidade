import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { loadOrders } from "../../helpers/loadOrders";
import { syncOpenShipments } from "../../helpers/syncShipment";
import type { OutputType } from "./orders_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    // Pull tracking codes from Melhor Envio before listing.
    await syncOpenShipments();
    const orders = await loadOrders({});
    return new Response(superjson.stringify({ orders } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin orders error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar os pedidos." }),
      { status: 500 },
    );
  }
}