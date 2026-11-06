import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./publicacao_pedir_POST.schema";

/** Guarda o pedido; a Vênus do celular busca a cada 2 minutos, faz e responde. */
export async function handle(request: Request) {
  try {
    const usuario = await requireAdmin(request);
    const s = schema.parse(superjson.parse(await request.text()));
    let titulo: string | null = null;
    if (s.tipo !== "story_outro") {
      if (s.quando.getTime() < Date.now() + 5 * 60_000) {
        return new Response(superjson.stringify({ error: "Escolha um horário daqui a pelo menos 5 minutos." }), { status: 400 });
      }
      const ideia = await db.selectFrom("publicacaoIdeias").select("titulo").where("ref", "=", s.ideiaRef).executeTakeFirst();
      if (!ideia) return new Response(superjson.stringify({ error: "Essa ideia não está mais na lista." }), { status: 404 });
      titulo = ideia.titulo;
    }
    const novo = await db
      .insertInto("publicacaoPedidos")
      .values({
        tipo: s.tipo,
        turno: s.tipo === "story_outro" ? s.turno : null,
        ideiaRef: s.tipo === "story_outro" ? null : s.ideiaRef,
        ideiaTitulo: titulo,
        quando: s.tipo === "story_outro" ? null : s.quando,
        legenda: s.tipo === "story_outro" ? null : (s.legenda ?? null),
        pedidoPor: usuario.displayName,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const texto =
      s.tipo === "story_outro"
        ? `${usuario.displayName} pediu outro story da ${s.turno === "manha" ? "manhã" : "tarde"}`
        : `${usuario.displayName} pediu para programar "${titulo}" como ${s.tipo === "story" ? "story" : "post"}`;
    await anotarAjuste(request, "story", texto);
    return new Response(superjson.stringify({ id: novo.id } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("publicacao pedir", error);
    return new Response(superjson.stringify({ error: "Não consegui fazer o pedido." }), { status: 400 });
  }
}