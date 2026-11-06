import { apiRequest } from "../../helpers/apiRequest";
import type { OrderDto } from "../../helpers/orderDto";

export type OutputType = { orders: OrderDto[] };

export const getMyOrders = () =>
  apiRequest<OutputType>("/_api/shop/orders", { method: "GET" });