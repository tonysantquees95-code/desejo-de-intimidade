import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "./Button";
import { PriceBlock } from "./PriceBlock";
import { useCart } from "../helpers/cart";
import { toast } from "../helpers/toast";
import type { CatalogProduct } from "../endpoints/catalog_GET.schema";
import styles from "./ProductCard.module.css";

export const ProductCard = ({
  product,
  whatsappNumber,
}: {
  product: CatalogProduct;
  whatsappNumber: string;
}) => {
  const cart = useCart();
  const href = `/produto/${product.id}`;
  return (
    <li className={styles.card}>
      <Link to={href} className={styles.imageWrap} aria-label={`Ver ${product.name}`}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" className={styles.image} />
        ) : null}
      </Link>
      <div className={styles.body}>
        <h2 className={styles.title}>
          <Link to={href}>{product.name}</Link>
        </h2>
        {product.description ? <p className={styles.text}>{product.description}</p> : null}
        {product.priceCents !== null ? (
          <PriceBlock priceCents={product.priceCents} compareAtCents={product.compareAtCents} />
        ) : null}
        <div className={styles.actions}>
          {product.priceCents !== null ? (
            <Button
              size="sm"
              className={styles.glow}
              onClick={() => {
                if (product.soldOut) {
                  toast("Produto esgotado");
                  return;
                }
                cart.add(product.id);
                toast("Adicionado ao carrinho");
              }}
            >
              <ShoppingBag size={16} /> {product.soldOut ? "Esgotado" : "Comprar"}
            </Button>
          ) : null}
          {whatsappNumber ? (
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  `Olá! Vi o produto "${product.name}" no site da Desejo de Intimidade e quero saber mais.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} /> Dúvidas
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
};