import React from "react";
import { formatCents } from "../helpers/formatCents";
import {
  PIX_DISCOUNT_PERCENT,
  isPromotion,
  pixPriceCents,
  promoPercentOff,
} from "../helpers/pricing";
import styles from "./PriceBlock.module.css";

export const PriceBlock = ({
  priceCents,
  compareAtCents,
  large,
}: {
  priceCents: number;
  compareAtCents: number | null;
  large?: boolean;
}) => {
  const info = { priceCents, compareAtCents };
  const promo = isPromotion(info);
  return (
    <div className={`${styles.block} ${large ? styles.large : ""}`}>
      {promo ? (
        <>
          <div className={styles.row}>
            <span className={styles.old}>{formatCents(compareAtCents as number)}</span>
            <span className={styles.badge}>-{promoPercentOff(info)}%</span>
          </div>
          <span className={styles.price}>{formatCents(priceCents)}</span>
        </>
      ) : (
        <>
          <span className={styles.price}>{formatCents(priceCents)}</span>
          <span className={styles.pix}>
            ou {formatCents(pixPriceCents(priceCents, false))} no Pix (
            {PIX_DISCOUNT_PERCENT}% de desconto)
          </span>
        </>
      )}
    </div>
  );
};