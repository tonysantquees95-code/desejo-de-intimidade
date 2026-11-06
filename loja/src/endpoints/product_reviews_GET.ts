import superjson from "superjson";
import { db } from "../helpers/db";
import type { OutputType } from "./product_reviews_GET.schema";

/** Public: reviews released by the owner for one product. */
export async function handle(request: Request) {
  try {
    const productId = Number(new URL(request.url).searchParams.get("productId"));
    if (!Number.isInteger(productId) || productId <= 0) {
      return new Response(superjson.stringify({ error: "Produto inválido." }), {
        status: 400,
      });
    }
    const base = () =>
      db
        .selectFrom("reviews")
        .where("productId", "=", productId)
        .where("kind", "=", "product")
        .where("visible", "=", true);

    const [stats, rows] = await Promise.all([
      base()
        .select(({ fn }) => [
          fn.countAll<string>().as("count"),
          fn.avg<string>("rating").as("average"),
        ])
        .executeTakeFirst(),
      base()
        .select(["id", "rating", "comment", "displayName", "createdAt"])
        .where("comment", "is not", null)
        .where("comment", "!=", "")
        .orderBy("id", "desc")
        .limit(20)
        .execute(),
    ]);

    return new Response(
      superjson.stringify({
        count: Number(stats?.count ?? 0),
        average: Number(stats?.average ?? 0),
        reviews: rows.map((r) => ({ ...r, comment: r.comment ?? "" })),
      } satisfies OutputType),
    );
  } catch (error) {
    console.error("product reviews error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar as avaliações." }),
      { status: 500 },
    );
  }
}