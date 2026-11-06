/** "89,90" | "R$ 1.234,50" | "89.9" -> cents, or null when empty/invalid. */
export function parsePriceToCents(text: string): number | null {
  const cleaned = text.replace(/[^\d,.]/g, "");
  if (!cleaned) return null;
  // Brazilian format: dots group thousands, comma is the decimal separator.
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}