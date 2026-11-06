import type { ShippingRegion } from "./shippingRegions";

/**
 * Maps a Brazilian CEP to a shipping region using the Correios CEP ranges
 * (first five digits). Returns null for an invalid CEP.
 */
export function regionFromCep(cep: string): ShippingRegion | null {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const prefix = Number(digits.slice(0, 5));

  if (prefix >= 1000 && prefix <= 39999) return "sudeste";
  if (prefix >= 40000 && prefix <= 65999) return "nordeste";
  if (prefix >= 66000 && prefix <= 69999) return "norte";
  if (prefix >= 70000 && prefix <= 76799) return "centro_oeste";
  if (prefix >= 76800 && prefix <= 77999) return "norte";
  if (prefix >= 78000 && prefix <= 78899) return "centro_oeste";
  if (prefix >= 78900 && prefix <= 78999) return "norte";
  if (prefix >= 79000 && prefix <= 79999) return "centro_oeste";
  if (prefix >= 80000 && prefix <= 99999) return "sul";
  return null;
}
