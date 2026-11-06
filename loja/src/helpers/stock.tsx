/** At or below this many units a product is "low stock" and the owner is warned. */
export const LOW_STOCK_THRESHOLD = 2;

export type StockStatus = "untracked" | "out" | "low" | "ok";

/** null = the owner does not track stock for this product. */
export function stockStatus(quantity: number | null): StockStatus {
  if (quantity === null) return "untracked";
  if (quantity <= 0) return "out";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}