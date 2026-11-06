import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./stories_marcar_POST.schema";

/** "Publicado": guarda quem postou e quando, para a outra pessoa não postar de novo. */
export async function handle(request: Request) {
  try {
    const usuario = await requireAdmin(request);
    const { id, onde } = schema.parse(superjson.parse(await request.text()));
    const atual = await db.selectFrom("storiesDia").selectAll().where("id", "=", id).executeTakeFirst();
    if (!atual) return new Response(superjson.stringify({ error: "Story não encontrado." }), { status: 404 });
    const ja = onde === "instagram" ? atual.instagramPor : atual.whatsappPor;
    if (ja) return new Response(superjson.stringify({ ok: true, por: ja, jaEstava: true } satisfies OutputType));
    const por = usuario.displayName;
    await db
      .updateTable("storiesDia")
      .set(onde === "instagram" ? { instagramPor: por, instagramEm: new Date() } : { whatsappPor: por, whatsappEm: new Date() })
      .where("id", "=", id)
      .execute();
    await anotarAjuste(request, "story", `${por} publicou o story "${atual.titulo}" no ${onde === "instagram" ? "Instagram" : "status do WhatsApp"}`);
    return new Response(superjson.stringify({ ok: true, por, jaEstava: false } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("stories marcar", error);
    return new Response(superjson.stringify({ error: "Não consegui marcar." }), { status: 400 });
  }
}