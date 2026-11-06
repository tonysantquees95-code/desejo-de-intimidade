import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { avisarEquipe } from "../../helpers/avisarEquipe";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./stories_novo_POST.schema";

/** Guarda o story do dia e avisa a equipe nos celulares. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const s = schema.parse(superjson.parse(await request.text()));
    const novo = await db
      .insertInto("storiesDia")
      .values({
        turno: s.turno,
        titulo: s.titulo,
        texto: s.texto,
        pergunta: s.pergunta ?? null,
        imagemUrl: s.imagemUrl,
        enquete: s.enquete,
        instagramPor: s.publicadoInstagram ? "Vênus (automático)" : null,
        instagramEm: s.publicadoInstagram ? new Date() : null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const avisados = await avisarEquipe(
      s.enquete && !s.publicadoInstagram
        ? {
            titulo: "Story da tarde pronto para a enquete",
            texto: `"${s.titulo}". Toque para postar no Instagram com a enquete: ${s.pergunta ?? "Você já sabia disso?"}`,
            tag: `story-${novo.id}`,
          }
        : {
            titulo: `Story da ${s.turno === "manha" ? "manhã" : "tarde"} publicado ✓`,
            texto: `"${s.titulo}". Toque para pôr também no status do WhatsApp.`,
            tag: `story-${novo.id}`,
          },
    );
    await anotarAjuste(request, "story", `Story da ${s.turno === "manha" ? "manhã" : "tarde"}: ${s.titulo}${s.enquete ? " (com enquete)" : ""} — ${avisados} celular(es) avisado(s)`);
    return new Response(superjson.stringify({ id: novo.id, avisados } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("stories novo", error);
    return new Response(superjson.stringify({ error: "Não consegui guardar o story." }), { status: 400 });
  }
}