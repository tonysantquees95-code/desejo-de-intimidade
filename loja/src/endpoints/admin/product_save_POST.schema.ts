import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Products, ProductCategoryArrayValues } from "../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  category: z.enum(ProductCategoryArrayValues),
  name: z.string().trim().min(1, "Informe o nome do produto").max(120),
  description: z.string().trim().max(600).nullable(),
  priceCents: z.number().int().min(0).max(10_000_000).nullable(),
  compareAtCents: z.number().int().min(0).max(10_000_000).nullable(),
  specifications: z.string().trim().max(2000).nullable(),
  // null = do not track stock for this product
  stockQuantity: z.number().int().min(0).max(100000).nullable(),
  weightGrams: z.number().int().min(10).max(30000).nullable(),
  widthCm: z.number().int().min(11).max(100).nullable(),
  heightCm: z.number().int().min(2).max(100).nullable(),
  lengthCm: z.number().int().min(16).max(100).nullable(),
  imageUrl: z.string().trim().max(1000).nullable(),
  active: z.boolean(),
  // Quanto a loja pagou por unidade (só o painel e o app da Vênus veem; nunca vai para o catálogo público).
  // Ausente = não mexe no custo já salvo; null = apaga.
  costCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { product: Selectable<Products> };

export const postProductSave = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/product_save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};