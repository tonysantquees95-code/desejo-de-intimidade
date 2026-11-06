import type { ShippingConfig } from "./shippingConfigSchema";
import { regionFromCep } from "./regionFromCep";

export type ShippingResult = {
  priceCents: number;
  /** Estimated business days; null for pickup. */
  days: number | null;
};

/** Pure shipping calculation. Throws a user-facing Error when not possible. */
export function calculateShipping(
  config: ShippingConfig,
  method: "sedex" | "pickup",
  cep: string | null,
): ShippingResult {
  if (method === "pickup") {
    if (!config.pickup.enabled) {
      throw new Error("A retirada em ponto de retirada não está disponível no momento.");
    }
    return { priceCents: 0, days: null };
  }
  const region = cep ? regionFromCep(cep) : null;
  if (!region) {
    throw new Error("Informe um CEP válido para calcular o frete.");
  }
  const rate = config.sedex[region];
  return { priceCents: rate.priceCents, days: rate.days };
}
