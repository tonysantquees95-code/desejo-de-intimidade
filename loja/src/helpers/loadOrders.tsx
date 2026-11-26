import { db } from "./db";
import type { OrderDto } from "./orderDto";
import type { Address } from "./addressSchema";

/** Loads orders with their items. Pass userId to scope to one customer. */
export async function loadOrders(filter: {
  userId?: number;
  orderId?: number;
}): Promise<OrderDto[]> {
  let query = db
    .selectFrom("orders")
    .innerJoin("users", "users.id", "orders.userId")
    .select([
      "orders.id",
      "orders.status",
      "orders.paymentMethod",
      "orders.deliveryMethod",
      "orders.subtotalCents",
      "orders.shippingCents",
      "orders.totalCents",
      "orders.discountCents",
      "orders.installments",
      "orders.customerName",
      "users.email as customerEmail",
      "orders.customerPhone",
      "orders.shippingAddress",
      "orders.pixQrText",
      "orders.paymentUrl",
      "orders.pixDiscountCents",
      "orders.pixExpiresAt",
      "orders.trackingCode",
      "orders.shippingService",
      "orders.shippingDays",
      "orders.melhorEnvioId",
      "orders.shipmentError",
      "orders.customerNotifiedStatus",
      "orders.paidAt",
      "orders.createdAt",
    ])
    .orderBy("orders.id", "desc")
    .limit(200);

  if (filter.userId !== undefined) {
    query = query.where("orders.userId", "=", filter.userId);
  }
  if (filter.orderId !== undefined) {
    query = query.where("orders.id", "=", filter.orderId);
  }

  const orders = await query.execute();
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);

  const items = await db
    .selectFrom("orderItems")
    .select([
      "id",
      "orderId",
      "productId",
      "name",
      "imageUrl",
      "unitPriceCents",
      "quantity",
    ])
    .where("orderId", "in", ids)
    .orderBy("id")
    .execute();

  const reviewedRows = await db
    .selectFrom("reviews")
    .select("orderId")
    .where("orderId", "in", ids)
    .groupBy("orderId")
    .execute();
  const reviewedIds = new Set(reviewedRows.map((r) => r.orderId));

  return orders.map(({ melhorEnvioId, customerNotifiedStatus, ...o }) => ({
    ...o,
    shipmentCreated: melhorEnvioId !== null && melhorEnvioId !== "pending",
    notifiedStatus: customerNotifiedStatus,
    reviewed: reviewedIds.has(o.id),
    shippingAddress: (o.shippingAddress as Address | null) ?? null,
    items: items
      .filter((i) => i.orderId === o.id)
      .map(({ orderId: _orderId, ...rest }) => rest),
  }));
}