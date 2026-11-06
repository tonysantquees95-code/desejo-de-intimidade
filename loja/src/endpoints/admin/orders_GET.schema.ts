import { apiRequest } from "../../helpers/apiRequest";
import type { OrderDto } from "../../helpers/orderDto";

export type OutputType = { orders: OrderDto[] };

export const getAdminOrders = () =>
  apiRequest<OutputType>("/_api/admin/orders", { method: "GET" });