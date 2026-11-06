import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import { calculateShipping } from "../../helpers/calculateShipping";
import { loadQuoteLines, quoteShipping } from "../../helpers/quoteShipping";
import { quoteMotoboy } from "../../helpers/motoboy";
import { createMelhorEnvioShipment } from "../../helpers/createMelhorEnvioShipment";
import { isPromotion, pixDiscountForLine } from "../../helpers/pricing";
import { LOW_STOCK_THRESHOLD } from "../../helpers/stock";
import { releaseOrderStock } from "../../helpers/releaseOrderStock";
import { notifyStockAlerts, type StockAlert } from "../../helpers/notifyStockAlerts";
import {
  mercadoPagoClient,
  MercadoPagoError,
  type MpPayment,
} from "../../helpers/mercadoPagoClient";
import { schema, type OutputType } from "./order_create_POST.schema";

class UserFacingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const rejectionMessages: Record<string, string> = {
  cc_rejected_insufficient_amount: "Saldo insuficiente no cartão.",
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_call_for_authorize: "Seu banco precisa autorizar este pagamento. Fale com ele ou use o Pix.",
  cc_rejected_card_disabled: "Cartão desabilitado. Use outro cartão ou o Pix.",
  cc_rejected_high_risk: "Pagamento não aprovado por segurança. Tente o Pix.",
};

function pixExpiration(minutes: number) {
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  // Mercado Pago wants the offset-qualified local time (Brasília, UTC-03:00)
  const local = new Date(expires.getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19);
  return { date: expires, text: `${local}.000-03:00` };
}

export async function handle(request: Request) {
  let orderId: number | null = null;
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));

    // Merge duplicate lines and load the real prices from the database.
    const quantities = new Map<number, number>();
    for (const line of input.items) {
      quantities.set(
        line.productId,
        Math.min(20, (quantities.get(line.productId) ?? 0) + line.quantity),
      );
    }
    const products = await db
      .selectFrom("products")
      .select(["id", "name", "imageUrl", "priceCents", "compareAtCents", "stockQuantity", "costCents"])
      .where("id", "in", [...quantities.keys()])
      .where("active", "=", true)
      .execute();
    if (products.length !== quantities.size) {
      throw new UserFacingError(
        "Algum produto do carrinho não está mais disponível. Atualize o carrinho.",
      );
    }
    const lines = products.map((p) => {
      if (p.priceCents === null) {
        throw new UserFacingError(
          `"${p.name}" está sem preço. Fale conosco pelo WhatsApp.`,
        );
      }
      const wanted = quantities.get(p.id) ?? 1;
      if (p.stockQuantity !== null && p.stockQuantity < wanted) {
        throw new UserFacingError(
          p.stockQuantity <= 0
            ? `"${p.name}" esgotou. Remova do carrinho para continuar.`
            : `Só temos ${p.stockQuantity} unidade(s) de "${p.name}". Ajuste a quantidade no carrinho.`,
        );
      }
      return {
        productId: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        unitPriceCents: p.priceCents,
        // custo do dia da venda (o lucro do pedido não muda se o custo mudar depois)
        unitCostCents: p.costCents,
        isPromo: isPromotion(p),
        stockQuantity: p.stockQuantity,
        quantity: quantities.get(p.id) ?? 1,
      };
    });

    const subtotalCents = lines.reduce(
      (sum, l) => sum + l.unitPriceCents * l.quantity,
      0,
    );

    const config = await loadShippingConfig();
    let shippingCents = 0;
    let shippingDays: number | null = null;
    let shippingService: string | null = null;
    if (input.deliveryMethod === "sedex") {
      if (!input.address) {
        throw new UserFacingError("Informe o endereço de entrega.");
      }
      if (!input.shippingService) {
        throw new UserFacingError("Escolha o tipo de envio.");
      }
      // Re-quote on the server: the price sent by the browser is never trusted.
      const options = await quoteShipping({
        config,
        cep: input.address.cep,
        lines: await loadQuoteLines(input.items, config),
      });
      const chosen = options.find((o) => o.service === input.shippingService);
      if (!chosen) {
        throw new UserFacingError(
          "Esse tipo de envio não está disponível para o seu CEP. Escolha outro.",
        );
      }
      shippingCents = chosen.priceCents;
      shippingDays = chosen.days || null;
      shippingService = chosen.service;
    } else if (input.deliveryMethod === "motoboy") {
      if (!input.address) {
        throw new UserFacingError("Informe o endereço de entrega.");
      }
      // Também refeito no servidor: o valor do motoboy depende só do CEP e da configuração da loja.
      const moto = await quoteMotoboy(config, input.address.cep);
      if (!moto.ok) {
        throw new UserFacingError(
          "A entrega por motoboy não está disponível para o seu CEP. Escolha outro tipo de entrega.",
        );
      }
      shippingCents = moto.priceCents;
      shippingDays = 1;
      shippingService = "motoboy";
    } else {
      calculateShipping(config, "pickup", null);
    }
    // 5% off when paying by Pix, except on products already on promotion.
    // Computed here, on the server: the browser's number is never trusted.
    const discountCents =
      input.payment.method === "pix"
        ? lines.reduce(
            (sum, l) =>
              sum + pixDiscountForLine(l.unitPriceCents, l.quantity, l.isPromo),
            0,
          )
        : 0;
    const totalCents = subtotalCents - discountCents + shippingCents;

    const installments =
      input.payment.method === "credit_card" ? input.payment.installments : 1;
    const cpf = input.customer.cpf.replace(/\D/g, "");
    const address = input.deliveryMethod !== "pickup" ? input.address : null;

    // If another account already owns this CPF, keep the order going but do not
    // take the CPF away from it (CPF is used to sign in, so it must stay unique).
    const cpfOwnedByOther = await db
      .selectFrom("customerProfiles")
      .select("userId")
      .where("cpf", "=", cpf)
      .where("userId", "<>", user.id)
      .executeTakeFirst();
    const profileCpf = cpfOwnedByOther ? undefined : cpf;
    const stockAlerts: StockAlert[] = [];

    // 1) Save the order (and remember the customer's data for next time)
    orderId = await db.transaction().execute(async (trx) => {
      const order = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          paymentMethod: input.payment.method,
          deliveryMethod: input.deliveryMethod,
          subtotalCents,
          shippingCents,
          discountCents,
          shippingService,
          shippingDays,
          totalCents,
          installments,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          shippingAddress: address,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("orderItems")
        .values(
          lines.map(({ isPromo: _isPromo, stockQuantity, ...l }) => ({
            ...l,
            orderId: order.id,
            stockReserved: stockQuantity !== null,
          })),
        )
        .execute();

      // Reserve the units. The guarded update makes overselling impossible,
      // even with two customers buying the last unit at the same time.
      for (const l of lines) {
        if (l.stockQuantity === null) continue;
        const updated = await trx
          .updateTable("products")
          .set({ stockQuantity: sql`stock_quantity - ${l.quantity}` })
          .where("id", "=", l.productId)
          .where("stockQuantity", ">=", l.quantity)
          .returning("stockQuantity")
          .executeTakeFirst();
        if (!updated || updated.stockQuantity === null) {
          throw new UserFacingError(
            `"${l.name}" acabou de esgotar. Atualize o carrinho.`,
          );
        }
        const before = updated.stockQuantity + l.quantity;
        if (
          updated.stockQuantity <= 0 ||
          (updated.stockQuantity <= LOW_STOCK_THRESHOLD && before > LOW_STOCK_THRESHOLD)
        ) {
          stockAlerts.push({ name: l.name, remaining: updated.stockQuantity });
        }
      }

      const profile = {
        cpf: profileCpf,
        phone: input.customer.phone,
        cep: address?.cep ?? null,
        street: address?.street ?? null,
        streetNumber: address?.number ?? null,
        complement: address?.complement ?? null,
        neighborhood: address?.neighborhood ?? null,
        city: address?.city ?? null,
        state: address?.state ?? null,
      };
      await trx
        .insertInto("customerProfiles")
        .values({ userId: user.id, ...profile })
        .onConflict((oc) =>
          oc.column("userId").doUpdateSet({
            ...(address ? profile : { cpf: profileCpf, phone: input.customer.phone }),
            updatedAt: sql`now()`,
          }),
        )
        .execute();
      return order.id;
    });

    // 2) Create the payment at Mercado Pago
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const [firstName, ...rest] = input.customer.name.split(/\s+/);
    const lastName = rest.join(" ") || firstName;

    const body: Record<string, unknown> = {
      transaction_amount: totalCents / 100,
      description: `Desejo de Intimidade - pedido ${orderId}`,
      external_reference: `pedido-${orderId}`,
      payer: {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: "CPF", number: cpf },
      },
      additional_info: {
        items: lines.map((l) => ({
          id: String(l.productId),
          title: l.name.slice(0, 250),
          quantity: l.quantity,
          unit_price: l.unitPriceCents / 100,
        })),
        payer: {
          first_name: firstName,
          last_name: lastName,
          phone: {
            area_code: input.customer.phone.slice(0, 2),
            number: input.customer.phone.slice(2),
          },
        },
      },
      ...(host
        ? { notification_url: `${proto}://${host}/_api/shop/mp_webhook` }
        : {}),
    };

    let pixExpiresAt: Date | null = null;
    if (input.payment.method === "pix") {
      const expiration = pixExpiration(30);
      pixExpiresAt = expiration.date;
      body.payment_method_id = "pix";
      body.date_of_expiration = expiration.text;
    } else {
      body.token = input.payment.token;
      body.installments = installments;
      body.payment_method_id = input.payment.paymentMethodId;
      const issuer = Number(input.payment.issuerId);
      if (input.payment.issuerId && Number.isFinite(issuer)) {
        body.issuer_id = issuer;
      }
    }

    let payment: MpPayment;
    try {
      payment = await mercadoPagoClient.createPayment(body, `pedido-${orderId}`);
    } catch (error) {
      await db
        .updateTable("orders")
        .set({ status: "canceled", updatedAt: sql`now()` })
        .where("id", "=", orderId)
        .execute();
      await releaseOrderStock(orderId);
      if (error instanceof MercadoPagoError) {
        console.error("Mercado Pago rejeitou o pagamento", error.status, JSON.stringify(error.details));
        throw new UserFacingError(
          input.payment.method === "credit_card"
            ? "O pagamento não foi aprovado. Confira os dados do cartão ou use o Pix."
            : "Não foi possível gerar o Pix agora. Tente novamente em instantes.",
          502,
        );
      }
      throw error;
    }

    // 3) Store what Mercado Pago answered
    let status: OutputType["status"] = "awaiting_payment";
    if (payment.status === "approved") {
      status = "paid";
    } else if (payment.status === "rejected" || payment.status === "cancelled") {
      status = "canceled";
    }

    await db
      .updateTable("orders")
      .set({
        status,
        paymentProviderId: String(payment.id),
        pixQrText: payment.point_of_interaction?.transaction_data?.qr_code ?? null,
        pixExpiresAt,
        paidAt: status === "paid" ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where("id", "=", orderId)
      .execute();

    if (status === "paid") {
      await createMelhorEnvioShipment(orderId);
    }

    if (status === "canceled") {
      await releaseOrderStock(orderId);
    } else {
      await notifyStockAlerts(stockAlerts).catch((e) =>
        console.error("stock alert error", e),
      );
    }

    if (status === "canceled") {
      throw new UserFacingError(
        (payment.status_detail && rejectionMessages[payment.status_detail]) ||
          "O pagamento foi recusado. Confira os dados do cartão ou use o Pix.",
        402,
      );
    }

    return new Response(
      superjson.stringify({ orderId, status } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    if (error instanceof UserFacingError) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: error.status,
      });
    }
    console.error("order create error", error);
    const message =
      error instanceof Error && error.name === "ZodError"
        ? "Confira os dados informados (CPF, telefone e endereço)."
        : error instanceof Error && error.message.includes("CEP")
          ? error.message
          : "Não foi possível finalizar o pedido. Tente novamente.";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}