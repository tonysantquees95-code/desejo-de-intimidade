import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./reviews_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const reviews = await db
      .selectFrom("reviews")
      .select([
        "id",
        "orderId",
        "kind",
        "productName",
        "rating",
        "comment",
        "displayName",
        "visible",
        "createdAt",
      ])
      .orderBy("id", "desc")
      .limit(200)
      .execute();
    return new Response(superjson.stringify({ reviews } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin reviews error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar as avaliações." }),
      { status: 500 },
    );
  }
}