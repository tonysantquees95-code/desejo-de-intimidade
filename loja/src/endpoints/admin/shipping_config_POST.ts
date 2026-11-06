import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./shipping_config_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const config = schema.parse(superjson.parse(await request.text()));
    await db
      .insertInto("siteSettings")
      .values({ key: "shipping_config", value: JSON.stringify(config) })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ value: JSON.stringify(config) }),
      )
      .execute();
    await anotarAjuste(request, "config", "Configurações de frete e entrega salvas");
    return new Response(superjson.stringify({ config } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("shipping config save error", error);
    return new Response(
      superjson.stringify({ error: "Confira os valores de frete informados." }),
      { status: 400 },
    );
  }
}