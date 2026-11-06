import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { salvarRegrasVenda } from "../../helpers/regrasVenda";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./regras_venda_POST.schema";

/** Guarda as regras de venda que vieram da Vênus app (a Vênus da Loja, o robô e o Direct passam a usá-las). */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const s = schema.parse(superjson.parse(await request.text()));
    const respostas = s.respostas ?? [];
    await salvarRegrasVenda(s.regras, s.texto ?? "", respostas);
    await anotarAjuste(request, "config", `Regras de venda atualizadas pela Vênus app (${respostas.length} respostas prontas)`);
    return new Response(superjson.stringify({ ok: true, respostas: respostas.length } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("regras venda", error);
    return new Response(superjson.stringify({ error: "Não consegui guardar as regras de venda." }), { status: 400 });
  }
}