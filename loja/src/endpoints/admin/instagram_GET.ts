import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import {
  SITE,
  PERGUNTAS_FREQUENTES,
  conexaoInstagram,
  conversasRecentes,
  directLigado,
  segredoConfere,
  tokenDeVerificacao,
} from "../../helpers/instagramDirect";
import type { OutputType } from "./instagram_GET.schema";

/** Situação do Direct automático do Instagram (sem nunca devolver o token). */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const c = await conexaoInstagram();
    const saida: OutputType = {
      conectado: !!c?.token,
      usuario: c?.usuario ?? "",
      ligado: await directLigado(),
      segredoConfigurado: !!process.env.INSTAGRAM_APP_SECRET,
      segredoConfere: await segredoConfere(),
      webhookUrl: `${SITE}/_api/instagram/webhook`,
      tokenVerificacao: await tokenDeVerificacao(),
      perguntas: PERGUNTAS_FREQUENTES,
      conversas: await conversasRecentes(),
    };
    return new Response(superjson.stringify(saida));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("admin instagram", error);
    return new Response(superjson.stringify({ error: "Não consegui ler o Direct do Instagram." }), { status: 500 });
  }
}