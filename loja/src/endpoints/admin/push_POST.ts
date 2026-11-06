import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./push_POST.schema";

/** Guarda (ou tira) o celular de quem ligou os avisos da equipe no painel. */
export async function handle(request: Request) {
  try {
    const usuario = await requireAdmin(request);
    const { acao, assinatura, identidade, antiga } = schema.parse(superjson.parse(await request.text()));
    if (antiga) await db.deleteFrom("pushInscricoes").where("identidade", "=", antiga).execute();
    if (acao === "remover") {
      if (identidade) await db.deleteFrom("pushInscricoes").where("identidade", "=", identidade).execute();
      return new Response(superjson.stringify({ ok: true } satisfies OutputType));
    }
    const id = String(assinatura?.endpoint ?? assinatura?.fcmToken ?? assinatura?.apnsToken ?? identidade ?? "");
    if (!assinatura || !id) return new Response(superjson.stringify({ error: "Inscrição inválida." }), { status: 400 });
    await db
      .insertInto("pushInscricoes")
      .values({ identidade: id, usuarioId: usuario.id, nome: usuario.displayName, assinatura: assinatura as never })
      .onConflict((oc) => oc.column("identidade").doUpdateSet({ usuarioId: usuario.id, nome: usuario.displayName, assinatura: assinatura as never }))
      .execute();
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const auth = authErrorResponse(error, superjson.stringify);
    if (auth) return auth;
    console.error("push POST", error);
    return new Response(superjson.stringify({ error: "Não consegui ligar os avisos." }), { status: 400 });
  }
}