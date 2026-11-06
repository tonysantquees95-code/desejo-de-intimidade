import { sql } from "kysely";
import { db } from "./db";
import type { OutputType } from "../endpoints/catalog_GET.schema";

/** Server-side catalog loader, shared by the /catalog endpoint and SSR prefetch. */
export async function loadCatalog(): Promise<OutputType> {
  const [products, setting, reviews] = await Promise.all([
    db
      .selectFrom("products")
      .select([
        "id",
        "category",
        "name",
        "description",
        "priceCents",
        "compareAtCents",
        "specifications",
        "imageUrl",
        sql<boolean>`coalesce(stock_quantity <= 0, false)`.as("soldOut"),
      ])
      .where("active", "=", true)
      .orderBy("sortOrder")
      .orderBy("id")
      .execute(),
    db
      .selectFrom("siteSettings")
      .select("value")
      .where("key", "=", "whatsapp_number")
      .executeTakeFirst(),
    db
      .selectFrom("reviews")
      .select(["id", "kind", "rating", "comment", "displayName", "productName"])
      .where("visible", "=", true)
      .where("comment", "is not", null)
      .where("comment", "!=", "")
      .where("rating", ">=", 4)
      .orderBy("id", "desc")
      .limit(6)
      .execute(),
  ]);

  return {
    whatsappNumber: setting?.value ?? "",
    products,
    reviews: reviews.map((r) => ({ ...r, comment: r.comment ?? "" })),
  };
}