import { db } from "../../helpers/db";
import { syncOrderPayment } from "../../helpers/syncOrderPayment";
import { schema } from "./mp_webhook_POST.schema";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = await request.text();
    const body = raw ? schema.parse(JSON.parse(raw)) : {};
    const type = ("type" in body ? body.type : undefined) ?? url.searchParams.get("type");
    const paymentId =
      ("data" in body && body.data ? String(body.data.id) : null) ??
      url.searchParams.get("data.id");

    // Only payment events matter. The body is never trusted: we re-read the
    // payment from Mercado Pago itself inside syncOrderPayment.
    if (type === "payment" && paymentId) {
      const order = await db
        .selectFrom("orders")
        .select("id")
        .where("paymentProviderId", "=", paymentId)
        .executeTakeFirst();
      if (order) await syncOrderPayment(order.id);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mercado pago webhook error", error);
    return new Response(JSON.stringify({ error: "webhook error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}