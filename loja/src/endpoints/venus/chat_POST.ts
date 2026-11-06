import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { venusAtendimento } from "../../helpers/venusAtendimento";
import { schema, type OutputType } from "./chat_POST.schema";

export async function handle(request: Request) {
  try {
    const { mensagem } = schema.parse(superjson.parse(await request.text()));
    // Cliente logado: a atendente pode mostrar os pedidos dele (e só os dele).
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch {
      userId = null;
    }
    const resposta = await venusAtendimento(mensagem, userId);
    return new Response(superjson.stringify(resposta satisfies OutputType));
  } catch (error) {
    console.error("venus chat error", error);
    return new Response(
      superjson.stringify({ error: "Não consegui responder agora. Tente de novo em instantes." }),
      { status: 400 },
    );
  }
}
