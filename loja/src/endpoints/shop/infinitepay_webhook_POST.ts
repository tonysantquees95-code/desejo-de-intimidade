import { db } from "../../helpers/db";
import { syncOrderPayment } from "../../helpers/syncOrderPayment";
import { infinitePayClient } from "../../helpers/infinitePayClient";

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

/**
 * Aviso de pagamento da InfinitePay. O corpo NÃO tem assinatura, então só serve para saber qual pedido
 * conferir: o pagamento de verdade é confirmado em syncOrderPayment (payment_check).
 */
export async function handle(request: Request) {
  try {
    const corpo = JSON.parse(await request.text()) as Record<string, unknown>;
    const ref = texto(corpo.order_nsu);
    const match = ref ? /^pedido-(\d{1,9})$/.exec(ref) : null;
    if (ref && match) {
      const slug = texto(corpo.invoice_slug) ?? texto(corpo.slug);
      const transacao = texto(corpo.transaction_nsu);
      if (!slug || !transacao) return ok();
      // Só guarda o aviso se a InfinitePay confirmar: um aviso falso não pode trocar os dados de um pedido de verdade.
      const check = await infinitePayClient.paymentCheck({ orderNsu: ref!, transactionNsu: transacao, slug });
      if (check.success === false || check.paid !== true) return ok();
      await db
        .insertInto("cobrancaAvisos")
        .values({ orderNsu: ref, slug, transactionNsu: transacao, corpo: JSON.stringify(corpo) })
        .onConflict((oc) =>
          oc.column("orderNsu").doUpdateSet({ slug, transactionNsu: transacao, corpo: JSON.stringify(corpo) }),
        )
        .execute();
      await syncOrderPayment(Number(match[1]));
    }
  } catch (error) {
    // Sempre 200: a página do pedido também confere sozinha; um erro aqui não deve virar reenvio infinito.
    console.error("infinitepay webhook error", error);
  }
  return ok();
}

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
