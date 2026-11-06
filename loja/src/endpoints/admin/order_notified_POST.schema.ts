import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ orderId: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postOrderNotified = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/order_notified", {
    method: "POST",
    body: schema.parse(body),
  });