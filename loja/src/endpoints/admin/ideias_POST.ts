import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./ideias_POST.schema";

/** Guarda as ideias de post que a Vênus estudou (para a página Publicações). */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { ideias } = schema.parse(superjson.parse(await request.text()));
    await db.transaction().execute(async (tx) => {
      await tx.deleteFrom("publicacaoIdeias").execute();
      if (ideias.length > 0) {
        await tx
          .insertInto("publicacaoIdeias")
          .values(ideias.map((i) => ({ ref: i.ref, titulo: i.titulo, data: i.data ?? null, formato: i.formato, legenda: i.legenda })))
          .onConflict((oc) => oc.column("ref").doNothing())
          .execute();
      }
    });
    return new Response(superjson.stringify({ ok: true, ideias: ideias.length } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("ideias POST", error);
    return new Response(superjson.stringify({ error: "Não consegui guardar as ideias." }), { status: 400 });
  }
}