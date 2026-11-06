import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

const comment = z
  .string()
  .trim()
  .max(500, "Comentário muito longo (máximo 500 caracteres)")
  .nullable();

export const schema = z
  .object({
    orderId: z.number().int().positive(),
    products: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          rating: z.number().int().min(1).max(5),
          comment,
        }),
      )
      .max(30),
    service: z
      .object({ rating: z.number().int().min(1).max(5), comment })
      .nullable(),
  })
  .refine((v) => v.products.length > 0 || v.service !== null, {
    message: "Dê pelo menos uma nota.",
  });

export type InputType = z.input<typeof schema>;
export type OutputType = { ok: true };

export const postReviewCreate = (body: InputType) =>
  apiRequest<OutputType>("/_api/shop/review_create", {
    method: "POST",
    body: schema.parse(body),
  });