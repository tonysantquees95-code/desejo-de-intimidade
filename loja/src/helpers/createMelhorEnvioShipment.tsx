import { sql } from "kysely";
import { db } from "./db";
import { loadShippingConfig } from "./loadShippingConfig";
import type { Address } from "./addressSchema";
import {
  isMelhorEnvioConfigured,
  melhorEnvioClient,
  MelhorEnvioError,
} from "./melhorEnvioClient";
import {
  MELHOR_ENVIO_SERVICE_IDS,
  volumeFromLines,
  type CorreiosService,
} from "./quoteShipping";

const digits = (v: string) => v.replace(/\D/g, "");

/** Collects every text found in a (possibly nested) Melhor Envio error body. */
function collectTexts(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((v) => collectTexts(v, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
      const texts = collectTexts(v, depth + 1);
      return typeof v === "object" && v !== null && !Array.isArray(v)
        ? texts
        : texts.map((t) => (t.includes(k) ? t : `${k}: ${t}`));
    });
  }
  return [];
}

function describeError(error: unknown): string {
  if (error instanceof MelhorEnvioError) {
    const texts = collectTexts(error.details);
    return texts.length > 0
      ? `Erro ${error.status}: ${texts.slice(0, 4).join(" | ")}`
      : `Erro ${error.status} no Melhor Envio.`;
  }
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

/**
 * Creates the shipment in the Melhor Envio cart for a paid order. Safe to call
 * more than once: only one call per order wins the claim. Failures are saved
 * on the order (shipmentError) so the owner can retry from the admin.
 */
export async function createMelhorEnvioShipment(orderId: number): Promise<void> {
  if (!isMelhorEnvioConfigured()) return;

  const claimed = await db
    .updateTable("orders")
    .set({ melhorEnvioId: "pending", shipmentError: null })
    .where("id", "=", orderId)
    .where("melhorEnvioId", "is", null)
    .where("deliveryMethod", "=", "sedex")
    .where("status", "in", ["paid", "preparing"])
    .returning("id")
    .executeTakeFirst();
  if (!claimed) return;

  try {
    const order = await db
      .selectFrom("orders")
      .innerJoin("users", "users.id", "orders.userId")
      .leftJoin("customerProfiles", "customerProfiles.userId", "orders.userId")
      .select([
        "orders.id",
        "orders.customerName",
        "orders.customerPhone",
        "orders.shippingAddress",
        "orders.shippingService",
        "orders.subtotalCents",
        "users.email as customerEmail",
        "customerProfiles.cpf as customerCpf",
      ])
      .where("orders.id", "=", orderId)
      .executeTakeFirstOrThrow();

    const address = order.shippingAddress as Address | null;
    if (!address) throw new Error("Pedido sem endereço de entrega.");
    const service = (order.shippingService ?? "sedex") as CorreiosService;

    const config = await loadShippingConfig();
    const s = config.sender;
    const senderDoc = digits(s.document);
    if (
      !s.name || !s.street || !s.number || !s.neighborhood || !s.city ||
      !s.state || !s.cep || !s.phone || !s.email || !senderDoc
    ) {
      throw new Error(
        "Complete os dados do remetente (telefone, e-mail e CPF/CNPJ) em Pedidos e entrega.",
      );
    }

    // Box size from the products bought (defaults when a product has none).
    const rows = await db
      .selectFrom("orderItems")
      .leftJoin("products", "products.id", "orderItems.productId")
      .select([
        "orderItems.quantity",
        "orderItems.unitPriceCents",
        "orderItems.productId",
        "products.weightGrams",
        "products.widthCm",
        "products.heightCm",
        "products.lengthCm",
      ])
      .where("orderItems.orderId", "=", orderId)
      .execute();
    const d = config.defaultPackage;
    const volume = volumeFromLines(
      rows.map((r) => ({
        productId: r.productId ?? 0,
        quantity: r.quantity,
        unitPriceCents: r.unitPriceCents,
        weightGrams: r.weightGrams ?? d.weightGrams,
        widthCm: r.widthCm ?? d.widthCm,
        heightCm: r.heightCm ?? d.heightCm,
        lengthCm: r.lengthCm ?? d.lengthCm,
      })),
    );
    const subtotalReais = order.subtotalCents / 100;

    const payload = {
      service: MELHOR_ENVIO_SERVICE_IDS[service],
      from: {
        name: s.name,
        phone: digits(s.phone),
        email: s.email,
        ...(senderDoc.length === 14
          ? { company_document: senderDoc }
          : { document: senderDoc }),
        address: s.street,
        complement: s.complement,
        number: s.number,
        district: s.neighborhood,
        city: s.city,
        state_abbr: s.state.toUpperCase(),
        country_id: "BR",
        postal_code: digits(s.cep),
      },
      to: {
        name: order.customerName,
        phone: digits(order.customerPhone),
        email: order.customerEmail,
        document: digits(order.customerCpf ?? ""),
        address: address.street,
        complement: address.complement,
        number: address.number,
        district: address.neighborhood,
        city: address.city,
        state_abbr: address.state,
        country_id: "BR",
        postal_code: digits(address.cep),
      },
      // Generic description on purpose: the declaration of content is read at the post office.
      products: [
        { name: "Acessórios de moda", quantity: 1, unitary_value: subtotalReais },
      ],
      volumes: [volume],
      options: {
        insurance_value: subtotalReais,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: true,
        platform: "Desejo de Intimidade",
        tags: [{ tag: `pedido-${orderId}`, url: null }],
      },
    };

    const created = await melhorEnvioClient.createCartItem(payload, s.email);
    await db
      .updateTable("orders")
      .set({
        melhorEnvioId: String(created.id),
        shipmentError: null,
        updatedAt: new Date(),
      })
      .where("id", "=", orderId)
      .execute();
  } catch (error) {
    console.error(
      "Melhor Envio: falha ao criar o envio",
      orderId,
      error instanceof MelhorEnvioError
        ? JSON.stringify({ status: error.status, details: error.details })
        : error,
    );
    await db
      .updateTable("orders")
      .set({
        melhorEnvioId: null,
        shipmentError: describeError(error).slice(0, 300),
        updatedAt: new Date(),
      })
      .where("id", "=", orderId)
      .execute();
  }
}