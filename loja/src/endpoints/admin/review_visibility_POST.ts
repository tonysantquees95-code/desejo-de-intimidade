import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./review_visibility_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { id, visible } = schema.parse(superjson.parse(await request.text()));
    await db.updateTable("reviews").set({ visible }).where("id", "=", id).execute();
    await anotarAjuste(request, "avaliacao", `Avaliação ${id} ${visible ? "liberada no site" : "escondida do site"}`);
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("review visibility error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível atualizar a avaliação." }),
      { status: 400 },
    );
  }
}