import { sql } from "kysely";
import { db } from "./db";
import { mercadoPagoClient } from "./mercadoPagoClient";
import { createMelhorEnvioShipment } from "./createMelhorEnvioShipment";
import { releaseOrderStock } from "./releaseOrderStock";

/**
 * Asks Mercado Pago (authenticated) for the real state of a payment and
 * updates our order. The webhook body is never trusted: it only tells us
 * which payment to re-check.
 */
export async function syncOrderPayment(orderId: number): Promise<void> {
  const order = await db
    .selectFrom("orders")
    .select(["id", "status", "paymentProviderId", "pixExpiresAt", "paymentMethod"])
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!order || order.status !== "awaiting_payment" || !order.paymentProviderId) {
    return;
  }

  const payment = await mercadoPagoClient.getPayment(order.paymentProviderId);

  if (payment.status === "approved") {
    await db
      .updateTable("orders")
      .set({ status: "paid", paidAt: sql`now()`, updatedAt: sql`now()` })
      .where("id", "=", order.id)
      .where("status", "=", "awaiting_payment")
      .execute();
    // Payment confirmed: create the shipment in Melhor Envio right away.
    await createMelhorEnvioShipment(order.id);
    return;
  }

  const failed = ["rejected", "cancelled", "refunded", "charged_back"].includes(
    payment.status,
  );
  const pixExpired =
    order.paymentMethod === "pix" &&
    order.pixExpiresAt !== null &&
    new Date(order.pixExpiresAt).getTime() < Date.now();

  if (failed || pixExpired) {
    await db
      .updateTable("orders")
      .set({ status: "canceled", updatedAt: sql`now()` })
      .where("id", "=", order.id)
      .where("status", "=", "awaiting_payment")
      .execute();
    // The units reserved for this order go back to stock
    await releaseOrderStock(order.id);
  }
}