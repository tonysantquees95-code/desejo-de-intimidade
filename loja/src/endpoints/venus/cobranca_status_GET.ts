import { db } from "../../helpers/db";
import type { OutputType } from "./cobranca_status_GET.schema";

const responder = (out: OutputType, status = 200) =>
  new Response(JSON.stringify(out), { status, headers: { "Content-Type": "application/json" } });

/** Confere na InfinitePay (payment_check) o pagamento avisado pelo webhook. */
export async function handle(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref")?.trim() ?? "";
  const handleTag = url.searchParams.get("handle")?.trim().replace(/^\$/, "") ?? "";
  const nada: OutputType = { pago: false, avisado: false, valorCentavos: null, forma: null, recibo: null };
  if (ref.length < 12 || !handleTag) return responder(nada, 400);
  try {
    const aviso = await db.selectFrom("cobrancaAvisos").selectAll().where("orderNsu", "=", ref).executeTakeFirst();
    if (!aviso || !aviso.slug || !aviso.transactionNsu) return responder(nada);
    const r = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: handleTag, order_nsu: ref, transaction_nsu: aviso.transactionNsu, slug: aviso.slug }),
    });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const corpo = (typeof aviso.corpo === "string" ? JSON.parse(aviso.corpo) : aviso.corpo) as Record<string, unknown> | null;
    const valor = Number(d.paid_amount ?? d.amount);
    return responder({
      pago: d.paid === true,
      avisado: true,
      valorCentavos: Number.isFinite(valor) ? valor : null,
      forma: typeof d.capture_method === "string" ? d.capture_method : null,
      recibo: typeof corpo?.receipt_url === "string" ? corpo.receipt_url : null,
    });
  } catch (error) {
    console.error("cobranca status", error);
    return responder(nada, 502);
  }
}