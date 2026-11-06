export const PIX_DISCOUNT_PERCENT = 5;
export const MAX_INSTALLMENTS = 3;
export const MIN_INSTALLMENT_CENTS = 2000;

type PriceInfo = { priceCents: number | null; compareAtCents: number | null };

/** A product is on promotion when it has an original price above the selling price. */
export function isPromotion(p: PriceInfo): boolean {
  return (
    p.priceCents !== null &&
    p.compareAtCents !== null &&
    p.compareAtCents > p.priceCents
  );
}

export function promoPercentOff(p: PriceInfo): number {
  if (!isPromotion(p)) return 0;
  return Math.round((1 - (p.priceCents as number) / (p.compareAtCents as number)) * 100);
}

/** Pix discount (cents) for one order line. Promotional products never get it. */
export function pixDiscountForLine(
  unitCents: number,
  quantity: number,
  promo: boolean,
): number {
  return promo ? 0 : Math.round((unitCents * quantity * PIX_DISCOUNT_PERCENT) / 100);
}

export function pixPriceCents(unitCents: number, promo: boolean): number {
  return unitCents - pixDiscountForLine(unitCents, 1, promo);
}

/** Card installments the store accepts: up to 3x, each at least R$ 20. */
export function installmentOptions(totalCents: number) {
  const options: { count: number; perCents: number }[] = [];
  for (let n = 1; n <= MAX_INSTALLMENTS; n++) {
    if (n === 1 || totalCents / n >= MIN_INSTALLMENT_CENTS) {
      options.push({ count: n, perCents: Math.ceil(totalCents / n) });
    }
  }
  return options;
}