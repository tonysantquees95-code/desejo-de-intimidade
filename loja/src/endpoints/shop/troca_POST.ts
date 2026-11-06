import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { avisarEquipe } from "../../helpers/avisarEquipe";
import { mensagemDaSolicitacao, nomeTipo } from "../../helpers/trocas";
import { schema, type OutputType } from "./troca_POST.schema";

const erro = (mensagem: string, status = 400) => new Response(superjson.stringify({ error: mensagem }), { status });

/** A cliente abre uma solicitação de troca, devolução ou reembolso de um pedido dela que já foi enviado. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const pedido = await db.selectFrom("orders").select(["id", "userId", "status"]).where("id", "=", input.orderId).executeTakeFirst();
    if (!pedido || pedido.userId !== user.id) return erro("Pedido não encontrado.", 404);
    if (pedido.status === "canceled") return erro("Este pedido foi cancelado. Se tiver alguma dúvida, fale com a loja pelo WhatsApp.");
    if (pedido.status !== "shipped" && pedido.status !== "delivered")
      return erro("Este pedido ainda não foi enviado. Para mudar ou cancelar, fale com a loja pelo WhatsApp.");

    const itens = input.itens.join(", ").slice(0, 1000);
    const nova = await db
      .insertInto("solicitacoesTroca")
      .values({ orderId: pedido.id, userId: user.id, tipo: input.tipo, preferencia: input.preferencia, itens, descricao: input.descricao })
      .returning("id")
      .executeTakeFirstOrThrow();

    await anotarAjuste(request, "pedido", `Solicitação de troca/devolução nº ${nova.id} do pedido #${pedido.id}: ${nomeTipo(input.tipo)}`, "site");
    try {
      await avisarEquipe({
        titulo: `Troca/devolução nº ${nova.id} (pedido #${pedido.id})`,
        texto: `${nomeTipo(input.tipo)}: ${input.descricao.slice(0, 120)}`,
        url: "/admin/trocas",
        tag: `troca-${nova.id}`,
      });
    } catch (e) {
      console.warn("troca aviso", e);
    }

    const mensagem = mensagemDaSolicitacao({ id: nova.id, orderId: pedido.id, tipo: input.tipo, preferencia: input.preferencia, itens, descricao: input.descricao });
    return new Response(superjson.stringify({ id: nova.id, mensagem } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("troca error", error);
    return erro(error instanceof Error && error.name === "ZodError" ? "Confira os campos do formulário." : "Não foi possível enviar a solicitação.");
  }
}