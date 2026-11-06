import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { firebaseConfigurado } from "../../helpers/firebasePush";
import type { OutputType } from "./avisos_GET.schema";

export async function handle(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const linha = await db
      .selectFrom("appDispositivos")
      .select([
        sql<number>`count(*)::int`.as("aparelhos"),
        sql<number>`count(usuario_id)::int`.as("comConta"),
        sql<number>`count(*) filter (where usuario_id = ${admin.id})::int`.as("meus"),
      ])
      .executeTakeFirst();
    return new Response(
      superjson.stringify({
        aparelhos: linha?.aparelhos ?? 0,
        comConta: linha?.comConta ?? 0,
        meus: linha?.meus ?? 0,
        firebasePronto: firebaseConfigurado(),
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("avisos GET", error);
    return new Response(superjson.stringify({ error: "Não foi possível carregar os avisos." }), { status: 400 });
  }
}
