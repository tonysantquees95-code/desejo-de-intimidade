import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { OutputType } from "./products_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const [products, setting] = await Promise.all([
      db
        .selectFrom("products")
        .selectAll()
        .orderBy("category")
        .orderBy("sortOrder")
        .orderBy("id")
        .execute(),
      db
        .selectFrom("siteSettings")
        .select("value")
        .where("key", "=", "whatsapp_number")
        .executeTakeFirst(),
    ]);
    return new Response(
      superjson.stringify({
        products,
        whatsappNumber: setting?.value ?? "",
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin products error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar os produtos." }),
      { status: 500 },
    );
  }
}