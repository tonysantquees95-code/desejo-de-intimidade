import superjson from "superjson";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { aplicarPerguntasFrequentes, conexaoInstagram, ligarDirect } from "../../helpers/instagramDirect";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./instagram_direct_POST.schema";

/** Liga/desliga o Direct automático e aplica as perguntas frequentes no Instagram. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { acao } = schema.parse(superjson.parse(await request.text()));
    let saida: OutputType;
    if (acao === "perguntas") {
      const erro = await aplicarPerguntasFrequentes();
      saida = erro ? { ok: false, mensagem: erro } : { ok: true, mensagem: "Perguntas frequentes aplicadas no Instagram." };
      if (!erro) await anotarAjuste(request, "robo", "Perguntas frequentes do Direct aplicadas no Instagram");
    } else {
      const ligar = acao === "ligar";
      if (ligar && !(await conexaoInstagram())) {
        saida = { ok: false, mensagem: "Conecte o Instagram pela Vênus app antes de ligar." };
      } else if (ligar && !process.env.INSTAGRAM_APP_SECRET) {
        saida = { ok: false, mensagem: "Falta a chave secreta do app da Meta (INSTAGRAM_APP_SECRET)." };
      } else {
        await ligarDirect(ligar);
        await anotarAjuste(request, "robo", ligar ? "Direct automático do Instagram ligado" : "Direct automático do Instagram desligado");
        saida = { ok: true, mensagem: ligar ? "Direct automático ligado." : "Direct automático desligado." };
      }
    }
    return new Response(superjson.stringify(saida));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("admin instagram direct", error);
    return new Response(superjson.stringify({ error: "Não consegui fazer isso agora." }), { status: 400 });
  }
}