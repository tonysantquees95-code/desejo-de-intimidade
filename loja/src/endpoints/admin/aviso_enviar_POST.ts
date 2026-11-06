import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { enviarAviso, firebaseConfigurado } from "../../helpers/firebasePush";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./aviso_enviar_POST.schema";

export async function handle(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    if (!firebaseConfigurado()) {
      return new Response(
        superjson.stringify({ error: "A chave do Firebase ainda não foi cadastrada." }),
        { status: 400 },
      );
    }

    let consulta = db.selectFrom("appDispositivos").select("token");
    if (input.destino === "teste") consulta = consulta.where("usuarioId", "=", admin.id);
    const aparelhos = await consulta.execute();
    if (aparelhos.length === 0) {
      return new Response(
        superjson.stringify({
          error:
            input.destino === "teste"
              ? "Nenhum celular seu está registrado. Abra o app, ative os avisos e entre na sua conta."
              : "Nenhum celular registrado para receber avisos ainda.",
        }),
        { status: 400 },
      );
    }

    const resultado = await enviarAviso(
      aparelhos.map((a) => a.token),
      { titulo: input.titulo, texto: input.texto, url: input.url },
    );
    if (input.destino === "todos") {
      await anotarAjuste(
        request,
        "avisos",
        `Aviso enviado para ${resultado.enviados} celulares: “${input.titulo}”`,
      );
    }
    return new Response(
      superjson.stringify({ ...resultado, total: aparelhos.length } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("aviso enviar", error);
    const mensagem = error instanceof Error && error.message.startsWith("O Firebase")
      ? error.message
      : "Não foi possível enviar o aviso.";
    return new Response(superjson.stringify({ error: mensagem }), { status: 400 });
  }
}
