import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(0).max(100000),
  /** "set" = new total, "add" = incoming goods added to the current stock */
  mode: z.enum(["set", "add"]),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { stockQuantity: number };

export const postStockUpdate = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/stock_update", {
    method: "POST",
    body: schema.parse(body),
  });