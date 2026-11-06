import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useCart } from "../helpers/cart";
import { useCatalog } from "../helpers/useCatalog";
import { formatCents } from "../helpers/formatCents";
import { FRETE_GRATIS_PADRAO } from "../helpers/shippingConfigSchema";
import styles from "./carrinho.module.css";

export default function CarrinhoPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { data, isFetching, isError } = useCatalog();

  const items = cart.lines.map((line) => ({
    line,
    product: data?.products.find((p) => p.id === line.productId) ?? null,
  }));
  const loading = isFetching && !data;
  const unavailable = items.filter(
    (i) =>
      !loading &&
      (!i.product || i.product.priceCents === null || i.product.soldOut),
  );
  const subtotal = items.reduce(
    (sum, i) => sum + (i.product?.priceCents ?? 0) * i.line.quantity,
    0,
  );

  return (
    <ShopLayout title="Meu carrinho">
      {cart.lines.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingBag size={40} />
          <p>Seu carrinho está vazio.</p>
          <Button asChild>
            <Link to="/#categorias">Ver produtos</Link>
          </Button>
        </div>
      ) : loading ? (
        <Skeleton className={styles.skeleton} />
      ) : isError ? (
        <p className={styles.error}>
          Não foi possível carregar os produtos. Tente novamente.
        </p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map(({ line, product }) => (
              <li key={line.productId} className={styles.row}>
                <div className={styles.thumb}>
                  {product?.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className={styles.thumbImg} />
                  ) : null}
                </div>
                <div className={styles.info}>
                  <span className={styles.name}>
                    {product?.name ?? "Produto indisponível"}
                  </span>
                  {product && product.priceCents !== null && !product.soldOut ? (
                    <span className={styles.price}>
                      {formatCents(product.priceCents)}
                    </span>
                  ) : (
                    <span className={styles.warn}>
                      Indisponível para compra no site. Remova do carrinho.
                    </span>
                  )}
                  <div className={styles.qty}>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Diminuir quantidade"
                      onClick={() => cart.setQuantity(line.productId, line.quantity - 1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className={styles.qtyValue}>{line.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Aumentar quantidade"
                      onClick={() => cart.setQuantity(line.productId, line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover do carrinho"
                      onClick={() => cart.remove(line.productId)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <span className={styles.lineTotal}>
                  {product?.priceCents != null
                    ? formatCents(product.priceCents * line.quantity)
                    : ""}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <strong>{formatCents(subtotal)}</strong>
            </div>
            <p className={styles.hint}>
              {subtotal >= FRETE_GRATIS_PADRAO.minSubtotalCents
                ? `Sua compra ganhou frete grátis no PAC para o Sul, Sudeste e Centro-Oeste (a loja paga até ${formatCents(FRETE_GRATIS_PADRAO.maxDiscountCents)}).`
                : `Faltam ${formatCents(FRETE_GRATIS_PADRAO.minSubtotalCents - subtotal)} para o frete grátis no PAC (Sul, Sudeste e Centro-Oeste; a loja paga até ${formatCents(FRETE_GRATIS_PADRAO.maxDiscountCents)}).`}{" "}
              O frete (SEDEX, PAC ou retirada em ponto de retirada) é calculado na próxima etapa.
            </p>
            <Button
              size="lg"
              className={styles.checkout}
              disabled={unavailable.length > 0 || subtotal === 0}
              onClick={() => navigate("/checkout")}
            >
              Finalizar compra
            </Button>
            <Button asChild variant="ghost">
              <Link to="/#categorias">Continuar comprando</Link>
            </Button>
          </div>
        </>
      )}
    </ShopLayout>
  );
}