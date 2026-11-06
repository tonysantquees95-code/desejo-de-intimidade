import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ orderId: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;
export type OutputType = {
  ok: true;
  refunded: boolean;
  /** true = removed from Melhor Envio, false = could not, null = nothing to remove */
  shipmentRemoved: boolean | null;
};

export const postOrderCancel = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/order_cancel", {
    method: "POST",
    body: schema.parse(body),
  });