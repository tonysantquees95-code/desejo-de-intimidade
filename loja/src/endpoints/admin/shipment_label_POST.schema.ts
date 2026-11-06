import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ orderId: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;
export type OutputType = { url: string };

export const postShipmentLabel = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/shipment_label", {
    method: "POST",
    body: schema.parse(body),
  });