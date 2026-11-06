import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./robo_ligar_POST.schema";

/** Liga ou desliga o robô do WhatsApp/Instagram (sem mexer no celular). */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { ligado } = schema.parse(superjson.parse(await request.text()));
    await db
      .insertInto("siteSettings")
      .values({ key: "robo_ligado", value: ligado ? "1" : "0" })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: ligado ? "1" : "0" }))
      .execute();
    await anotarAjuste(request, "robo", ligado ? "Robô do WhatsApp e Instagram ligado" : "Robô do WhatsApp e Instagram desligado");
    return new Response(superjson.stringify({ ligado } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    return new Response(superjson.stringify({ error: "Não consegui mudar o robô." }), { status: 400 });
  }
}