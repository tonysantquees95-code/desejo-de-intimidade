import { db } from "./db";
import { mercadoPagoClient } from "./mercadoPagoClient";
import { infinitePayClient } from "./infinitePayClient";
import { createMelhorEnvioShipment } from "./createMelhorEnvioShipment";
import { releaseOrderStock } from "./releaseOrderStock";

/** Pedidos novos pagam pela InfinitePay; os antigos (Pix/cartão do Mercado Pago) continuam sendo conferidos como antes. */
export async function syncOrderPayment(orderId: number): Promise<void> {
  const order = await db
    .selectFrom("orders")
    .select([
      "id",
      "status",
      "paymentProviderId",
      "pixExpiresAt",
      "paymentMethod",
      "totalCents",
      "pixDiscountCents",
    ])
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!order || order.status !== "awaiting_payment") return;

  if (order.paymentMethod === "infinitepay") {
    await syncInfinitePay(order);
    return;
  }
  if (!order.paymentProviderId) return;

  // --- Mercado Pago (pedidos feitos antes da troca) ---
  const payment = await mercadoPagoClient.getPayment(order.paymentProviderId);

  if (payment.status === "approved") {
    await markPaid(order.id, {});
    return;
  }

  const failed = ["rejected", "cancelled", "refunded", "charged_back"].includes(
    payment.status,
  );
  const pixExpired =
    order.paymentMethod === "pix" &&
    order.pixExpiresAt !== null &&
    new Date(order.pixExpiresAt).getTime() < Date.now();
  if (failed || pixExpired) await cancelUnpaid(order.id);
}

async function markPaid(
  orderId: number,
  change: {
    paymentMethod?: "pix" | "credit_card";
    totalCents?: number;
    discountCents?: number;
    installments?: number;
  },
) {
  await db
    .updateTable("orders")
    .set({ ...change, status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where("id", "=", orderId)
    .where("status", "=", "awaiting_payment")
    .execute();
  // Payment confirmed: create the shipment in Melhor Envio right away.
  await createMelhorEnvioShipment(orderId);
}

async function cancelUnpaid(orderId: number) {
  await db
    .updateTable("orders")
    .set({ status: "canceled", updatedAt: new Date() })
    .where("id", "=", orderId)
    .where("status", "=", "awaiting_payment")
    .execute();
  // The units reserved for this order go back to stock
  await releaseOrderStock(orderId);
}

/**
 * Asks InfinitePay (payment_check) for the real state of the payment. The webhook body is never
 * trusted: it only gives us the slug and the transaction id to re-check.
 */
async function syncInfinitePay(order: {
  id: number;
  pixExpiresAt: Date | null;
  totalCents: number;
  pixDiscountCents: number;
}) {
  const nsu = `pedido-${order.id}`;
  const aviso = await db
    .selectFrom("cobrancaAvisos")
    .select(["slug", "transactionNsu"])
    .where("orderNsu", "=", nsu)
    .executeTakeFirst();

  if (aviso?.slug && aviso.transactionNsu) {
    const r = await infinitePayClient.paymentCheck({
      orderNsu: nsu,
      transactionNsu: aviso.transactionNsu,
      slug: aviso.slug,
    });
    if (r.success !== false && r.paid === true) {
      const viaPix = r.capture_method === "pix";
      const expected = viaPix ? order.totalCents - order.pixDiscountCents : order.totalCents;
      const paid = Number(r.paid_amount ?? r.amount);
      // Never mark as paid if less than the order's price came in (2 cents of rounding allowed).
      if (!Number.isFinite(paid) || paid < expected - 2) {
        console.error("InfinitePay: valor pago menor que o do pedido", order.id, paid, expected);
        return;
      }
      await markPaid(
        order.id,
        viaPix
          ? {
              paymentMethod: "pix",
              discountCents: order.pixDiscountCents,
              totalCents: expected,
            }
          : {
              paymentMethod: "credit_card",
              installments: Math.min(12, Math.max(1, Number(r.installments) || 1)),
            },
      );
      return;
    }
  }

  // Link nunca pago e já vencido: cancela e devolve o estoque.
  if (order.pixExpiresAt !== null && new Date(order.pixExpiresAt).getTime() < Date.now()) {
    await cancelUnpaid(order.id);
  }
}
