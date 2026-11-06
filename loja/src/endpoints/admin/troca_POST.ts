import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { ESTADOS_TROCA } from "../../helpers/trocas";
import { schema, type OutputType } from "./troca_POST.schema";

/** A loja muda o estado da solicitação (em análise, aprovada, recusada, concluída) e guarda uma anotação. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { id, estado, resposta } = schema.parse(superjson.parse(await request.text()));
    await db
      .updateTable("solicitacoesTroca")
      .set({ estado, resposta: resposta || null, atualizado: new Date() })
      .where("id", "=", id)
      .execute();
    await anotarAjuste(request, "pedido", `Solicitação de troca/devolução nº ${id}: ${ESTADOS_TROCA[estado].toLowerCase()}`);
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin troca error", error);
    return new Response(superjson.stringify({ error: "Não foi possível salvar." }), { status: 400 });
  }
}