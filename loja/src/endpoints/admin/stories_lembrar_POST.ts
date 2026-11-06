import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { avisarEquipe } from "../../helpers/avisarEquipe";
import { schema, type OutputType } from "./stories_lembrar_POST.schema";

/** Segundo aviso (o app Vênus chama 1 hora depois): só se ninguém marcou que publicou no Instagram. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { id } = schema.parse(superjson.parse(await request.text()));
    const s = await db.selectFrom("storiesDia").selectAll().where("id", "=", id).executeTakeFirst();
    if (!s || s.instagramPor) return new Response(superjson.stringify({ lembrou: false } satisfies OutputType));
    await avisarEquipe({
      titulo: "Ainda falta o story da tarde",
      texto: `"${s.titulo}" está pronto, só falta postar com a enquete. Toque para abrir.`,
      tag: `story-lembrete-${s.id}`,
    });
    return new Response(superjson.stringify({ lembrou: true } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("stories lembrar", error);
    return new Response(superjson.stringify({ error: "Não consegui lembrar." }), { status: 400 });
  }
}