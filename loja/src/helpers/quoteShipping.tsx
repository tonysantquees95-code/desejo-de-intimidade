import { db } from "./db";
import type { ShippingConfig } from "./shippingConfigSchema";
import { regionFromCep } from "./regionFromCep";
import {
  isMelhorEnvioConfigured,
  melhorEnvioClient,
} from "./melhorEnvioClient";

export type CorreiosService = "sedex" | "pac";

export type QuoteOption = {
  service: CorreiosService;
  priceCents: number;
  days: number;
  /** true when it comes from the fallback table, not a live quote */
  estimated: boolean;
  /** Preço cheio, quando o frete grátis (com teto) abateu parte ou tudo. */
  originalPriceCents?: number;
};

/**
 * Frete grátis com teto: nas regiões escolhidas e a partir do valor mínimo, abate até maxDiscountCents
 * do PAC (ou do envio mais barato, onde o PAC não é oferecido). O SEDEX continua pelo preço cheio quando há PAC.
 */
export function aplicarFreteGratis(options: QuoteOption[], config: ShippingConfig, cep: string, subtotalCents: number): QuoteOption[] {
  const f = config.freeShipping;
  const regiao = regionFromCep(cep);
  if (!f.enabled || !regiao || !f.regions.includes(regiao) || subtotalCents < f.minSubtotalCents || options.length === 0) {
    return options.sort((a, b) => a.priceCents - b.priceCents);
  }
  const alvo = options.find((o) => o.service === "pac") ?? [...options].sort((a, b) => a.priceCents - b.priceCents)[0];
  return options
    .map((o) =>
      o === alvo ? { ...o, originalPriceCents: o.priceCents, priceCents: Math.max(0, o.priceCents - f.maxDiscountCents) } : o,
    )
    .sort((a, b) => a.priceCents - b.priceCents);
}

export type QuoteLine = {
  productId: number;
  quantity: number;
  unitPriceCents: number;
  weightGrams: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
};

/** Melhor Envio service ids for the Correios services we offer. */
export const MELHOR_ENVIO_SERVICE_IDS: Record<CorreiosService, number> = {
  pac: 1,
  sedex: 2,
};

/** Merges repeated products and loads prices + package sizes from the database. */
export async function loadQuoteLines(
  items: { productId: number; quantity: number }[],
  config: ShippingConfig,
): Promise<QuoteLine[]> {
  const quantities = new Map<number, number>();
  for (const item of items) {
    quantities.set(
      item.productId,
      Math.min(20, (quantities.get(item.productId) ?? 0) + item.quantity),
    );
  }
  const products = await db
    .selectFrom("products")
    .select([
      "id",
      "name",
      "priceCents",
      "weightGrams",
      "widthCm",
      "heightCm",
      "lengthCm",
    ])
    .where("id", "in", [...quantities.keys()])
    .where("active", "=", true)
    .execute();
  if (products.length !== quantities.size) {
    throw new Error(
      "Algum produto do carrinho não está mais disponível. Atualize o carrinho.",
    );
  }
  const d = config.defaultPackage;
  return products.map((p) => {
    if (p.priceCents === null) {
      throw new Error(`"${p.name}" está sem preço. Fale conosco pelo WhatsApp.`);
    }
    return {
      productId: p.id,
      quantity: quantities.get(p.id) ?? 1,
      unitPriceCents: p.priceCents,
      weightGrams: p.weightGrams ?? d.weightGrams,
      widthCm: p.widthCm ?? d.widthCm,
      heightCm: p.heightCm ?? d.heightCm,
      lengthCm: p.lengthCm ?? d.lengthCm,
    };
  });
}

/** One box for the whole order: widest/longest item, heights stacked, weights summed. */
export function volumeFromLines(lines: QuoteLine[]) {
  return {
    width: Math.max(...lines.map((l) => l.widthCm)),
    length: Math.max(...lines.map((l) => l.lengthCm)),
    height: Math.max(
      2,
      lines.reduce((sum, l) => sum + l.heightCm * l.quantity, 0),
    ),
    weight:
      Math.max(
        10,
        lines.reduce((sum, l) => sum + l.weightGrams * l.quantity, 0),
      ) / 1000,
  };
}

/**
 * Quotes SEDEX/PAC through Melhor Envio. If Melhor Envio is not configured or
 * fails, falls back to the regional SEDEX table, flagged as "estimated".
 */
export async function quoteShipping(params: {
  config: ShippingConfig;
  cep: string;
  lines: QuoteLine[];
}): Promise<QuoteOption[]> {
  const { config, lines } = params;
  const cep = params.cep.replace(/\D/g, "");
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const subtotalReais = subtotalCents / 100;

  if (
    isMelhorEnvioConfigured() &&
    config.sender.cep &&
    config.sender.email
  ) {
    try {
      const result = await melhorEnvioClient.calculate(
        {
          from: { postal_code: config.sender.cep.replace(/\D/g, "") },
          to: { postal_code: cep },
          package: volumeFromLines(lines),
          options: {
            insurance_value: subtotalReais,
            receipt: false,
            own_hand: false,
          },
          services: "1,2",
        },
        config.sender.email,
      );
      const options: QuoteOption[] = [];
      for (const item of Array.isArray(result) ? result : []) {
        const service = (Object.keys(MELHOR_ENVIO_SERVICE_IDS) as CorreiosService[]).find(
          (s) => MELHOR_ENVIO_SERVICE_IDS[s] === item.id,
        );
        const price = Number(item.custom_price ?? item.price);
        const days = Number(item.custom_delivery_time ?? item.delivery_time);
        if (!service || item.error || !Number.isFinite(price) || price <= 0) {
          continue;
        }
        options.push({
          service,
          priceCents: Math.round(price * 100),
          days: Number.isFinite(days) && days > 0 ? days : 0,
          estimated: false,
        });
      }
      if (options.length > 0) {
        return aplicarFreteGratis(options, config, cep, subtotalCents);
      }
    } catch (error) {
      console.error("Melhor Envio: cotação falhou, usando tabela", error);
    }
  }

  const region = regionFromCep(cep);
  if (!region) return [];
  const rate = config.sedex[region];
  return aplicarFreteGratis(
    [
      {
        service: "sedex",
        priceCents: rate.priceCents,
        days: rate.days,
        estimated: true,
      },
    ],
    config,
    cep,
    subtotalCents,
  );
}