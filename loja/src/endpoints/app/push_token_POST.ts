import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, type OutputType } from "./push_token_POST.schema";

/**
 * Registra o celular (código do Firebase) que aceitou receber avisos no app Android.
 * Se houver alguém logado, liga o celular à conta, para avisar sobre os pedidos dela.
 */
export async function handle(request: Request) {
  try {
    const texto = await request.text();
    let corpo: unknown = null;
    try {
      const bruto = JSON.parse(texto);
      corpo = bruto && typeof bruto === "object" && "json" in bruto ? superjson.parse(texto) : bruto;
    } catch {
      corpo = null;
    }
    const { token } = schema.parse(corpo);

    let usuarioId: number | null = null;
    try {
      usuarioId = (await getServerUserSession(request)).user.id;
    } catch {
      usuarioId = null; // visitante sem conta: recebe só promoções
    }

    await db
      .insertInto("appDispositivos")
      .values({ token, usuarioId })
      .onConflict((oc) =>
        oc.column("token").doUpdateSet({
          atualizado: sql`now()`,
          // Sem login agora: mantém a conta que já estava ligada a este celular.
          usuarioId: usuarioId === null ? sql`app_dispositivos.usuario_id` : usuarioId,
        }),
      )
      .execute();

    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (erro) {
    console.error("registro de aparelho para avisos", erro);
    return new Response(
      superjson.stringify({ error: "Não foi possível registrar o aparelho." }),
      { status: 400 },
    );
  }
}
