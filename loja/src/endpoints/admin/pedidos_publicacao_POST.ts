import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { avisarEquipe } from "../../helpers/avisarEquipe";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./pedidos_publicacao_POST.schema";

/** Resultado de um pedido da página Publicações: guarda e avisa a equipe nos celulares. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const s = schema.parse(superjson.parse(await request.text()));
    const pedido = await db
      .updateTable("publicacaoPedidos")
      .set({ estado: s.ok ? "feito" : "erro", resultado: s.resultado, imagemUrl: s.imagemUrl ?? null, atualizado: new Date() })
      .where("id", "=", s.id)
      .returning(["tipo", "ideiaTitulo", "turno"])
      .executeTakeFirst();
    if (!pedido) return new Response(superjson.stringify({ error: "Pedido não encontrado." }), { status: 404 });
    const nome =
      pedido.tipo === "story_outro" ? `Story da ${pedido.turno === "manha" ? "manhã" : "tarde"}` : `"${pedido.ideiaTitulo ?? "Ideia"}"`;
    await avisarEquipe({
      titulo: s.ok ? `${nome}: pronto ✓` : `${nome}: não deu certo`,
      texto: s.resultado.slice(0, 160),
      url: "/admin/publicacoes",
      tag: `publicacao-${s.id}`,
    });
    await anotarAjuste(request, "story", `${nome}: ${s.resultado.slice(0, 200)}`, undefined, s.ok);
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("pedidos publicacao POST", error);
    return new Response(superjson.stringify({ error: "Não consegui guardar o resultado." }), { status: 400 });
  }
}