import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";
import { OrderStatusArrayValues } from "../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive(),
  status: z.enum(OrderStatusArrayValues),
  trackingCode: z.string().trim().max(60).nullable(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postOrderUpdate = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/order_update", {
    method: "POST",
    body: schema.parse(body),
  });