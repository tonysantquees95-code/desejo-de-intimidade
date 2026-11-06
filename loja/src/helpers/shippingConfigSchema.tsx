import { z } from "zod";

/**
 * Frete grátis: nas compras a partir de [minSubtotalCents] (preço dos produtos), para as regiões escolhidas,
 * a loja paga até [maxDiscountCents] do PAC (ou do envio mais barato, onde não há PAC); passando disso o cliente paga a diferença.
 */
export const FRETE_GRATIS_PADRAO = {
  enabled: true,
  minSubtotalCents: 18_000,
  maxDiscountCents: 3_000,
  regions: ["sul", "sudeste", "centro_oeste"] as ("sudeste" | "sul" | "centro_oeste" | "nordeste" | "norte")[],
};

const rateSchema = z.object({
  priceCents: z.number().int().min(0).max(1_000_000),
  days: z.number().int().min(1).max(60),
});

export const shippingConfigSchema = z.object({
  // Fallback table, used only when Melhor Envio cannot quote.
  sedex: z.object({
    sudeste: rateSchema,
    sul: rateSchema,
    centro_oeste: rateSchema,
    nordeste: rateSchema,
    norte: rateSchema,
  }),
  pickup: z.object({
    enabled: z.boolean(),
    address: z.string().trim().max(300),
    note: z.string().trim().max(300),
  }),
  // Entrega Expressa via Motoboy: taxa de saída + valor por km rodado (da loja até o endereço).
  motoboy: z
    .object({
      enabled: z.boolean(),
      // Taxa mínima / saída fixa, em centavos (700 = R$ 7,00).
      baseCents: z.number().int().min(0).max(100_000),
      // valorPorKm: valor de cada quilômetro rodado, em centavos (200 = R$ 2,00 por km).
      perKmCents: z.number().int().min(0).max(100_000),
      // Acima dessa distância o motoboy não é oferecido.
      maxKm: z.number().int().min(1).max(200),
    })
    .default({ enabled: true, baseCents: 700, perKmCents: 200, maxKm: 30 }),
  // Sender: printed on labels and sent to Melhor Envio.
  sender: z.object({
    name: z.string().trim().max(80),
    street: z.string().trim().max(120),
    number: z.string().trim().max(20),
    complement: z.string().trim().max(80),
    neighborhood: z.string().trim().max(80),
    city: z.string().trim().max(80),
    state: z.string().trim().max(2),
    cep: z.string().trim().max(9),
    phone: z.string().trim().max(20).default(""),
    email: z.string().trim().max(120).default(""),
    document: z.string().trim().max(20).default(""),
  }),
  freeShipping: z
    .object({
      enabled: z.boolean(),
      minSubtotalCents: z.number().int().min(0).max(10_000_000),
      maxDiscountCents: z.number().int().min(0).max(1_000_000),
      regions: z.array(z.enum(["sudeste", "sul", "centro_oeste", "nordeste", "norte"])),
    })
    .default(FRETE_GRATIS_PADRAO),
  // Box used when a product has no weight/size of its own.
  defaultPackage: z
    .object({
      weightGrams: z.number().int().min(10).max(30000),
      widthCm: z.number().int().min(11).max(100),
      heightCm: z.number().int().min(2).max(100),
      lengthCm: z.number().int().min(16).max(100),
    })
    .default({ weightGrams: 300, widthCm: 16, heightCm: 6, lengthCm: 20 }),
});

export type ShippingConfig = z.infer<typeof shippingConfigSchema>;