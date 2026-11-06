import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { inicioDeHoje } from "../../helpers/ajustesLog";
import type { OutputType } from "./robo_GET.schema";

type Msg = { de: "cliente" | "venus"; texto: string; quando: number };

/** Como está o robô do WhatsApp/Instagram: ligado, chave, atendimentos de hoje e clientes esperando a loja. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const config = await db.selectFrom("siteSettings").select(["key", "value"]).where("key", "in", ["robo_ligado", "robo_chave"]).execute();
    const valor = (k: string) => config.find((c) => c.key === k)?.value ?? "";
    const inicio = inicioDeHoje().getTime();
    const linhas = await db.selectFrom("venusRobo").selectAll().where("atualizado", ">=", new Date(Date.now() - 7 * 86_400_000)).execute();
    let atendimentos = 0;
    let clientes = 0;
    let passadas = 0;
    const esperando: OutputType["esperando"] = [];
    for (const l of linhas) {
      const bruto = typeof l.mensagens === "string" ? (JSON.parse(l.mensagens) as unknown) : l.mensagens;
      const msgs = (Array.isArray(bruto) ? bruto : []) as Msg[];
      const deHoje = msgs.filter((m) => m.de === "venus" && m.quando >= inicio).length;
      if (deHoje > 0) {
        atendimentos += deHoje;
        clientes++;
      }
      if (l.pausadoAte && new Date(l.pausadoAte).getTime() > Date.now()) {
        const ultima = [...msgs].reverse().find((m) => m.de === "cliente");
        if (ultima && ultima.quando >= inicio) passadas++;
        esperando.push({ canal: l.canal, ultimaMensagem: (ultima?.texto ?? "").slice(0, 200), quando: new Date(ultima?.quando ?? Date.now()) });
      }
    }
    esperando.sort((a, b) => b.quando.getTime() - a.quando.getTime());
    const endereco = `${new URL(request.url).origin}/_api/venus/robo`;
    return new Response(
      superjson.stringify({ ligado: valor("robo_ligado") !== "0", chave: valor("robo_chave"), endereco, hoje: { atendimentos, clientes, passadas }, esperando } satisfies OutputType),
    );
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("robo GET", error);
    return new Response(superjson.stringify({ error: "Não consegui ler o robô." }), { status: 400 });
  }
}