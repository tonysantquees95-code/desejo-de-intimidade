import { apiRequest } from "../../helpers/apiRequest";
import {
  shippingConfigSchema,
  type ShippingConfig,
} from "../../helpers/shippingConfigSchema";

export const schema = shippingConfigSchema;
export type InputType = ShippingConfig;
export type OutputType = { config: ShippingConfig };

export const postShippingConfig = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/shipping_config", {
    method: "POST",
    body: schema.parse(body),
  });