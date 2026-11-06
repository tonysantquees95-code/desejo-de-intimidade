import { sql } from "kysely";
import { db } from "./db";
import type { OrderStatus } from "./schema";
import { loadShippingConfig } from "./loadShippingConfig";
import { isMelhorEnvioConfigured, melhorEnvioClient } from "./melhorEnvioClient";
import { avisarPedidoEnviado } from "./firebasePush";

/**
 * Reads the shipment from Melhor Envio and, once the label has a tracking
 * code, saves it on the order so the customer sees it. Also moves the order to
 * "shipped" / "delivered" when the carrier reports it.
 */
export async function syncShipment(orderId: number): Promise<void> {
  if (!isMelhorEnvioConfigured()) return;
  const order = await db
    .selectFrom("orders")
    .select(["id", "status", "melhorEnvioId", "trackingCode"])
    .where("id", "=", orderId)
    .executeTakeFirst();
  if (
    !order ||
    !order.melhorEnvioId ||
    order.melhorEnvioId === "pending" ||
    order.status === "delivered" ||
    order.status === "canceled"
  ) {
    return;
  }

  const config = await loadShippingConfig();
  const remote = await melhorEnvioClient.getOrder(
    order.melhorEnvioId,
    config.sender.email,
  );

  let status: OrderStatus = order.status;
  if (remote.status === "delivered") status = "delivered";
  else if (remote.status === "posted") status = "shipped";
  else if (remote.tracking && order.status === "paid") status = "preparing";

  const tracking = remote.tracking?.trim() || order.trackingCode;
  if (tracking !== order.trackingCode || status !== order.status) {
    await db
      .updateTable("orders")
      .set({ trackingCode: tracking, status, updatedAt: sql`now()` })
      .where("id", "=", order.id)
      .execute();
    // Avisa o cliente no app quando a transportadora confirma a postagem.
    if (status === "shipped" && order.status !== "shipped") {
      await avisarPedidoEnviado(order.id);
    }
  }
}

/** Syncs the open shipments (used by the admin list). Errors are only logged. */
export async function syncOpenShipments(limit = 15): Promise<void> {
  if (!isMelhorEnvioConfigured()) return;
  const open = await db
    .selectFrom("orders")
    .select("id")
    .where("melhorEnvioId", "is not", null)
    .where("melhorEnvioId", "!=", "pending")
    .where("status", "in", ["paid", "preparing", "shipped"])
    .orderBy("id", "desc")
    .limit(limit)
    .execute();
  await Promise.allSettled(
    open.map((o) =>
      syncShipment(o.id).catch((e) => console.error("sync shipment", o.id, e)),
    ),
  );
}