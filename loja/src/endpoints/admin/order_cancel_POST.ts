import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import {
  mercadoPagoClient,
  MercadoPagoError,
} from "../../helpers/mercadoPagoClient";
import {
  isMelhorEnvioConfigured,
  melhorEnvioClient,
} from "../../helpers/melhorEnvioClient";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import { releaseOrderStock } from "../../helpers/releaseOrderStock";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./order_cancel_POST.schema";

function mpMessage(error: MercadoPagoError): string {
  const d = error.details as { message?: string; cause?: { description?: string }[] } | null;
  return d?.cause?.[0]?.description ?? d?.message ?? `erro ${error.status}`;
}

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { orderId } = schema.parse(superjson.parse(await request.text()));

    const order = await db
      .selectFrom("orders")
      .select(["id", "status", "paymentProviderId", "melhorEnvioId", "trackingCode"])
      .where("id", "=", orderId)
      .executeTakeFirst();
    if (!order) {
      return new Response(superjson.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
      });
    }
    if (!["paid", "preparing", "shipped"].includes(order.status)) {
      return new Response(
        superjson.stringify({
          error: "Só dá para cancelar e estornar pedidos pagos que ainda não foram entregues.",
        }),
        { status: 400 },
      );
    }

    // 1) Refund the customer first. If this fails, nothing else changes.
    let refunded = false;
    if (order.paymentProviderId) {
      try {
        await mercadoPagoClient.refundPayment(
          order.paymentProviderId,
          `estorno-pedido-${order.id}`,
        );
        refunded = true;
      } catch (error) {
        console.error("order cancel: refund failed", order.id, error);
        if (error instanceof MercadoPagoError) {
          return new Response(
            superjson.stringify({
              error: `O Mercado Pago não fez o estorno: ${mpMessage(error)}. O pedido continua como estava.`,
            }),
            { status: 400 },
          );
        }
        throw error;
      }
    }

    // 2) Mark the order as canceled
    await db
      .updateTable("orders")
      .set({ status: "canceled", updatedAt: sql`now()` })
      .where("id", "=", order.id)
      .execute();
    await releaseOrderStock(order.id);
    await anotarAjuste(request, "pedido", `Pedido #${order.id} cancelado${refunded ? " e estornado no Mercado Pago" : ""}`);

    // 3) Best effort: take the unpaid shipment out of the Melhor Envio cart
    let shipmentRemoved: boolean | null = null;
    if (
      order.melhorEnvioId &&
      order.melhorEnvioId !== "pending" &&
      !order.trackingCode &&
      isMelhorEnvioConfigured()
    ) {
      try {
        const config = await loadShippingConfig();
        await melhorEnvioClient.deleteCartItem(order.melhorEnvioId, config.sender.email);
        shipmentRemoved = true;
      } catch (error) {
        console.error("order cancel: could not remove shipment", order.id, error);
        shipmentRemoved = false;
      }
    }

    return new Response(
      superjson.stringify({ ok: true, refunded, shipmentRemoved } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("order cancel error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível cancelar o pedido." }),
      { status: 400 },
    );
  }
}