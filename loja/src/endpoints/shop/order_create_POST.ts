import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { loadShippingConfig } from "../../helpers/loadShippingConfig";
import { calculateShipping } from "../../helpers/calculateShipping";
import { loadQuoteLines, quoteShipping } from "../../helpers/quoteShipping";
import { quoteMotoboy } from "../../helpers/motoboy";
import { isPromotion, pixDiscountForLine } from "../../helpers/pricing";
import { LOW_STOCK_THRESHOLD } from "../../helpers/stock";
import { releaseOrderStock } from "../../helpers/releaseOrderStock";
import { notifyStockAlerts, type StockAlert } from "../../helpers/notifyStockAlerts";
import {
  infinitePayClient,
  InfinitePayError,
  infiniteApiKey,
} from "../../helpers/infinitePayClient";
import { schema, type OutputType } from "./order_create_POST.schema";

class UserFacingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Quanto tempo o link de pagamento fica aberto (depois disso o pedido é cancelado e o estoque volta). */
const LINK_MINUTES = 120;

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
    // Computed here, on the server. It is only charged if the customer pays by Pix
    // (InfinitePay applies it on its page; see "options.discounts" below).
    // Without the InfinitePay API key the link cannot carry the Pix discount, so none is promised.
    const pixDiscountCents = infiniteApiKey()
      ? lines.reduce(
          (sum, l) => sum + pixDiscountForLine(l.unitPriceCents, l.quantity, l.isPromo),
          0,
        )
      : 0;
    const discountCents = 0;
    const totalCents = subtotalCents + shippingCents;

    const installments = 1;
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
          paymentMethod: "infinitepay",
          deliveryMethod: input.deliveryMethod,
          subtotalCents,
          shippingCents,
          discountCents,
          pixDiscountCents,
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
            updatedAt: new Date(),
          }),
        )
        .execute();
      return order.id;
    });

    // 2) Create the InfinitePay payment link (the customer pays on InfinitePay's secure page)
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = host ? `${proto}://${host}` : null;

    // One line per product (total of the line already includes quantity), plus the shipping.
    const linkItems = lines.map((l) => ({
      quantity: 1,
      price: l.unitPriceCents * l.quantity,
      description: (l.quantity > 1 ? `${l.quantity}x ` : "") + l.name.slice(0, 100),
    }));
    if (shippingCents > 0) {
      linkItems.push({ quantity: 1, price: shippingCents, description: "Frete" });
    }
    // The percentage InfinitePay applies on Pix, so that promo products stay without discount.
    const pixPercent =
      pixDiscountCents > 0
        ? Math.round((pixDiscountCents / totalCents) * 100 * 10000) / 10000
        : 0;
    const expiresAt = new Date(Date.now() + LINK_MINUTES * 60 * 1000);
    const phoneDigits = input.customer.phone;

    let paymentUrl: string;
    try {
      paymentUrl = await infinitePayClient.createLink({
        orderNsu: `pedido-${orderId}`,
        items: linkItems,
        redirectUrl: origin ? `${origin}/pedido/${orderId}` : undefined,
        webhookUrl: origin ? `${origin}/_api/shop/infinitepay_webhook` : undefined,
        customer: {
          name: input.customer.name,
          email: user.email,
          phone_number: `+55${phoneDigits}`,
        },
        options: {
          assured_installments: 3,
          single_payment: true,
          valid_until: expiresAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
          ...(pixPercent > 0 ? { discounts: { pix: pixPercent } } : {}),
        },
      });
    } catch (error) {
      await db
        .updateTable("orders")
        .set({ status: "canceled", updatedAt: new Date() })
        .where("id", "=", orderId)
        .execute();
      await releaseOrderStock(orderId);
      if (error instanceof InfinitePayError) {
        console.error("InfinitePay não criou o link", error.status, JSON.stringify(error.details));
      } else {
        console.error("InfinitePay link error", error);
      }
      throw new UserFacingError(
        "Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
        502,
      );
    }

    // 3) Remember the link (the order stays "awaiting_payment" until InfinitePay confirms)
    await db
      .updateTable("orders")
      .set({
        status: "awaiting_payment",
        paymentUrl,
        pixExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where("id", "=", orderId)
      .execute();
    await notifyStockAlerts(stockAlerts).catch((e) =>
      console.error("stock alert error", e),
    );
    const status: OutputType["status"] = "awaiting_payment";

    return new Response(
      superjson.stringify({ orderId, status, paymentUrl } satisfies OutputType),
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