import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { salvarConexaoInstagram } from "../../helpers/instagramDirect";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./instagram_token_POST.schema";

/** Guarda o token do Instagram da loja (para o Direct automático responder pela API oficial). */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const s = schema.parse(superjson.parse(await request.text()));
    await salvarConexaoInstagram({ token: s.token, contaId: s.contaId, usuario: s.usuario });
    await anotarAjuste(request, "config", `Instagram conectado no site${s.usuario ? ` (@${s.usuario.replace(/^@/, "")})` : ""}`);
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("instagram token", error);
    return new Response(superjson.stringify({ error: "Não consegui guardar o token do Instagram." }), { status: 400 });
  }
}