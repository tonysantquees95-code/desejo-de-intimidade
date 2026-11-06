import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./stock_update_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const updated = await db
      .updateTable("products")
      .set({
        stockQuantity:
          input.mode === "add"
            ? sql`coalesce(stock_quantity, 0) + ${input.quantity}`
            : input.quantity,
        updatedAt: sql`now()`,
      })
      .where("id", "=", input.productId)
      .returning(["stockQuantity", "name"])
      .executeTakeFirst();
    if (!updated || updated.stockQuantity === null) {
      return new Response(
        superjson.stringify({ error: "Produto não encontrado." }),
        { status: 404 },
      );
    }
    await anotarAjuste(
      request,
      "estoque",
      `${updated.name}: ${input.mode === "add" ? `${input.quantity >= 0 ? "+" : ""}${input.quantity} unidades` : "estoque definido"}, agora ${updated.stockQuantity}`,
    );
    return new Response(
      superjson.stringify({ stockQuantity: updated.stockQuantity } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("stock update error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível atualizar o estoque." }),
      { status: 400 },
    );
  }
}