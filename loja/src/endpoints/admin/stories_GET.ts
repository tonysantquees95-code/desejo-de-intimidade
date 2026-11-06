import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./stories_GET.schema";

/** Os stories dos últimos 7 dias e quem recebe os avisos. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const stories = await db
      .selectFrom("storiesDia")
      .selectAll()
      .where("criado", ">=", new Date(Date.now() - 7 * 86_400_000))
      .orderBy("id", "desc")
      .limit(30)
      .execute();
    const avisos = await db.selectFrom("pushInscricoes").select("nome").execute();
    const avisosLigados = [...new Set(avisos.map((a) => a.nome ?? "Sem nome"))];
    return new Response(superjson.stringify({ stories, avisosLigados } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("stories GET", error);
    return new Response(superjson.stringify({ error: "Não consegui ler os stories." }), { status: 500 });
  }
}