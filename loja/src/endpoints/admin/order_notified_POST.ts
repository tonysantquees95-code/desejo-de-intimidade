import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./order_notified_POST.schema";

/** Marks that the customer was told about the order's current status. */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { orderId } = schema.parse(superjson.parse(await request.text()));
    await db
      .updateTable("orders")
      .set({ customerNotifiedStatus: sql`status::text`, updatedAt: sql`now()` })
      .where("id", "=", orderId)
      .execute();
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("order notified error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível registrar o aviso." }),
      { status: 400 },
    );
  }
}