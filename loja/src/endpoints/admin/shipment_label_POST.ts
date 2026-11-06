import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import {
  melhorEnvioClient,
  MelhorEnvioError,
} from "../../helpers/melhorEnvioClient";
import { schema, type OutputType } from "./shipment_label_POST.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { orderId } = schema.parse(superjson.parse(await request.text()));
    const order = await db
      .selectFrom("orders")
      .select("melhorEnvioId")
      .where("id", "=", orderId)
      .executeTakeFirst();
    if (!order?.melhorEnvioId || order.melhorEnvioId === "pending") {
      return new Response(
        superjson.stringify({ error: "Este pedido ainda não tem envio no Melhor Envio." }),
        { status: 400 },
      );
    }
    const config = await loadShippingConfig();
    const result = await melhorEnvioClient.printLabels(
      [order.melhorEnvioId],
      config.sender.email,
    );
    return new Response(superjson.stringify({ url: result.url } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("shipment label error", error);
    const message =
      error instanceof MelhorEnvioError
        ? "Não foi possível gerar a etiqueta. Pague o envio no Melhor Envio primeiro."
        : "Não foi possível abrir a etiqueta.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}