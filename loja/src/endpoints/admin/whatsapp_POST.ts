import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, OutputType } from "./whatsapp_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    await db
      .insertInto("siteSettings")
      .values({ key: "whatsapp_number", value: input.whatsappNumber })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ value: input.whatsappNumber }),
      )
      .execute();
    await anotarAjuste(request, "config", `WhatsApp da loja trocado para ${input.whatsappNumber}`);
    return new Response(
      superjson.stringify({
        whatsappNumber: input.whatsappNumber,
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    const message =
      error instanceof Error && error.name === "ZodError"
        ? "Informe o número com DDD, por exemplo 5511999998888."
        : "Não foi possível salvar o número.";
    console.error("whatsapp save error", error);
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}