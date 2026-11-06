import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import type { OutputType } from "./shipping_config_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const config = await loadShippingConfig();
    return new Response(superjson.stringify({ config } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("shipping config error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar o frete." }),
      { status: 500 },
    );
  }
}