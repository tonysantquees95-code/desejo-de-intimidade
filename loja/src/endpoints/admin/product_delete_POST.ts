import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, OutputType } from "./product_delete_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const apagado = await db.deleteFrom("products").where("id", "=", input.id).returning("name").executeTakeFirst();
    if (apagado) await anotarAjuste(request, "produto", `Produto excluído: ${apagado.name}`);
    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("product delete error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível excluir o produto." }),
      { status: 400 },
    );
  }
}