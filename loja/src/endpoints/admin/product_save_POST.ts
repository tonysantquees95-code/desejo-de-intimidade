import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { anotarAjuste, reais } from "../../helpers/ajustesLog";
import { schema, OutputType } from "./product_save_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const values = {
      category: input.category,
      name: input.name,
      description: input.description || null,
      priceCents: input.priceCents,
      compareAtCents: input.compareAtCents,
      specifications: input.specifications || null,
      stockQuantity: input.stockQuantity,
      priceText: null,
      weightGrams: input.weightGrams,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      lengthCm: input.lengthCm,
      imageUrl: input.imageUrl || null,
      active: input.active,
      // só grava o custo quando ele veio no pedido (telas antigas não apagam o custo salvo)
      ...(input.costCents !== undefined ? { costCents: input.costCents } : {}),
    };

    if (input.id !== undefined) {
      const antes = await db
        .selectFrom("products")
        .select(["priceCents", "compareAtCents", "stockQuantity", "active", "costCents"])
        .where("id", "=", input.id)
        .executeTakeFirst();
      const product = await db
        .updateTable("products")
        .set({ ...values, updatedAt: new Date() })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirst();
      if (!product) {
        return new Response(
          superjson.stringify({ error: "Produto não encontrado." }),
          { status: 404 },
        );
      }
      const mudancas: string[] = [];
      if (antes) {
        if (antes.priceCents !== product.priceCents) mudancas.push(`preço ${reais(antes.priceCents)} → ${reais(product.priceCents)}`);
        if (antes.compareAtCents !== product.compareAtCents)
          mudancas.push(product.compareAtCents ? `em promoção (de ${reais(product.compareAtCents)})` : "saiu da promoção");
        if (antes.stockQuantity !== product.stockQuantity) mudancas.push(`estoque ${antes.stockQuantity ?? "—"} → ${product.stockQuantity ?? "—"}`);
        if (antes.active !== product.active) mudancas.push(product.active ? "agora aparece no site" : "escondido do site");
        if (antes.costCents !== product.costCents) mudancas.push(`custo ${reais(antes.costCents)} → ${reais(product.costCents)}`);
      }
      await anotarAjuste(request, "produto", `${product.name}: ${mudancas.length ? mudancas.join(", ") : "dados atualizados"}`);
      return new Response(superjson.stringify({ product } satisfies OutputType));
    }

    // New products go to the end of their category.
    const last = await db
      .selectFrom("products")
      .select(({ fn }) => fn.max("sortOrder").as("maxOrder"))
      .where("category", "=", input.category)
      .executeTakeFirst();
    const product = await db
      .insertInto("products")
      .values({ ...values, sortOrder: (last?.maxOrder ?? 0) + 1 })
      .returningAll()
      .executeTakeFirstOrThrow();
    await anotarAjuste(request, "produto", `Produto novo: ${product.name} por ${reais(product.priceCents)}${product.active ? "" : " (escondido do site)"}`);
    return new Response(superjson.stringify({ product } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    const message =
      error instanceof Error && error.name === "ZodError"
        ? "Dados inválidos. Confira os campos."
        : "Não foi possível salvar o produto.";
    console.error("product save error", error);
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}