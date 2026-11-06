import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { ajustesDesde, inicioDeHoje, resumoAjustes } from "../../helpers/ajustesLog";
import type { OutputType } from "./ajustes_GET.schema";

/** Os ajustes dos últimos 30 dias (até 300) e o resumo de hoje. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const ajustes = await ajustesDesde(new Date(Date.now() - 30 * 86_400_000));
    const hoje = inicioDeHoje().getTime();
    const deHoje = ajustes.filter((a) => new Date(a.quando).getTime() >= hoje);
    return new Response(superjson.stringify({ ajustes, resumoHoje: resumoAjustes(deHoje) } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("ajustes GET", error);
    return new Response(superjson.stringify({ error: "Não consegui ler o registro." }), { status: 500 });
  }
}