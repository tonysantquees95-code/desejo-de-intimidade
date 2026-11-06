import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { loadOrders } from "../../helpers/loadOrders";
import type { OutputType } from "./orders_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const orders = await loadOrders({ userId: user.id });
    return new Response(superjson.stringify({ orders } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("orders error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar seus pedidos." }),
      { status: 500 },
    );
  }
}