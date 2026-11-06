import { apiRequest } from "../../helpers/apiRequest";
import type { ShippingConfig } from "../../helpers/shippingConfigSchema";

export type OutputType = { config: ShippingConfig };

export const getShippingConfig = () =>
  apiRequest<OutputType>("/_api/admin/shipping_config", { method: "GET" });