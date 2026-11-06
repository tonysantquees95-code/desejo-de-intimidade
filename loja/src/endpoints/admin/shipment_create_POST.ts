import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { createMelhorEnvioShipment } from "../../helpers/createMelhorEnvioShipment";
import { isMelhorEnvioConfigured } from "../../helpers/melhorEnvioClient";
import { anotarAjuste } from "../../helpers/ajustesLog";
import { schema, type OutputType } from "./shipment_create_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { orderId } = schema.parse(superjson.parse(await request.text()));
    if (!isMelhorEnvioConfigured()) {
      return new Response(
        superjson.stringify({ error: "O Melhor Envio ainda não está conectado." }),
        { status: 400 },
      );
    }
    await createMelhorEnvioShipment(orderId);
    const order = await db
      .selectFrom("orders")
      .select(["melhorEnvioId", "shipmentError"])
      .where("id", "=", orderId)
      .executeTakeFirst();
    const criado = Boolean(order?.melhorEnvioId && order.melhorEnvioId !== "pending");
    await anotarAjuste(request, "pedido", `Pedido #${orderId}: envio no Melhor Envio ${criado ? "criado" : `não criado (${order?.shipmentError ?? "erro"})`}`, undefined, criado);
    return new Response(
      superjson.stringify({
        ok: true,
        shipmentCreated: Boolean(order?.melhorEnvioId && order.melhorEnvioId !== "pending"),
        error: order?.shipmentError ?? null,
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("shipment create error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível criar o envio." }),
      { status: 400 },
    );
  }
}