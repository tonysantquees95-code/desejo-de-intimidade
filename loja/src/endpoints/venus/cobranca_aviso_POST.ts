import { db } from "../../helpers/db";

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

/** Guarda o aviso da InfinitePay (order_nsu, slug da fatura e transaction_nsu) para o app conferir depois. */
export async function handle(request: Request) {
  try {
    const corpo = JSON.parse(await request.text()) as Record<string, unknown>;
    const ref = texto(corpo.order_nsu);
    if (ref) {
      const slug = texto(corpo.invoice_slug) ?? texto(corpo.slug);
      const transacao = texto(corpo.transaction_nsu);
      await db
        .insertInto("cobrancaAvisos")
        .values({ orderNsu: ref, slug, transactionNsu: transacao, corpo: JSON.stringify(corpo) })
        .onConflict((oc) => oc.column("orderNsu").doUpdateSet({ slug, transactionNsu: transacao, corpo: JSON.stringify(corpo) }))
        .execute();
      console.log(`cobranca aviso: ${ref}`);
    }
  } catch (error) {
    console.error("cobranca aviso", error);
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}