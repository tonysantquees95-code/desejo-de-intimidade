import { apiRequest } from "../../helpers/apiRequest";
import type { OrderDto } from "../../helpers/orderDto";

export type OutputType = { order: OrderDto };

export const getOrder = (id: number) =>
  apiRequest<OutputType>(`/_api/shop/order?id=${id}`, { method: "GET" });