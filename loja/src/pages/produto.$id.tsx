import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Minus,
  Plus,
  MessageCircle,
  ShoppingBag,
  Star,
  Truck,
  CreditCard,
} from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { PriceBlock } from "../components/PriceBlock";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { useCatalog } from "../helpers/useCatalog";
import { useCart } from "../helpers/cart";
import { toast } from "../helpers/toast";
import { formatCents } from "../helpers/formatCents";
import { productCategories } from "../helpers/productCategories";
import { SITE_URL, absoluteUrl } from "../helpers/siteUrl";
import {
  PIX_DISCOUNT_PERCENT,
  installmentOptions,
  isPromotion,
  pixPriceCents,
} from "../helpers/pricing";
import { getProductReviews } from "../endpoints/product_reviews_GET.schema";
import { postShippingQuote } from "../endpoints/shop/shipping_quote_POST.schema";
import styles from "./produto.module.css";

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function ProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const validId = Number.isInteger(productId) && productId > 0;
  const navigate = useNavigate();
  const cart = useCart();
  const { data, isFetching } = useCatalog();
  const product = data?.products.find((p) => p.id === productId) ?? null;

  const [quantity, setQuantity] = useState(1);
  const [cep, setCep] = useState("");
  const quote = useMutation({ mutationFn: postShippingQuote });

  const reviews = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => getProductReviews(productId),
    enabled: validId,
  });

  const calculate = (event: React.FormEvent) => {
    event.preventDefault();
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      toast.error("Informe o CEP com 8 números.");
      return;
    }
    quote.mutate(
      { cep: digits, items: [{ productId, quantity }] },
      { onError: () => toast.error("Não foi possível calcular o frete agora.") },
    );
  };

  const whatsappNumber = data?.whatsappNumber ?? "";
  const category = product
    ? productCategories.find((c) => c.id === product.category)
    : null;
  const specRows = (product?.specifications ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0
        ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() }
        : { label: "", value: l };
    });

  const loading = isFetching && !data;
  const promo = product ? isPromotion(product) : false;
  const unit = product?.priceCents ?? null;
  const lineTotal = unit !== null ? unit * quantity : null;
  const productUrl = `${SITE_URL}/produto/${productId}`;
  const ogImage = product?.imageUrl
    ? absoluteUrl(product.imageUrl)
    : absoluteUrl("/_cdn/static/86d30161-7ae8-424f-a57b-78ebd06a5975-logo-og.jpg");
  const productJsonLd =
    product && unit !== null
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description ?? product.name,
          image: [ogImage],
          sku: String(product.id),
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "BRL",
            price: (unit / 100).toFixed(2),
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
          },
          ...(reviews.data && reviews.data.count > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: reviews.data.average.toFixed(1),
                  reviewCount: reviews.data.count,
                },
              }
            : {}),
        }
      : null;
  const breadcrumbJsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
          ...(category
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: category.title,
                  item: `${SITE_URL}/categoria/${category.slug}`,
                },
              ]
            : []),
          { "@type": "ListItem", position: category ? 3 : 2, name: product.name, item: productUrl },
        ],
      }
    : null;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {product ? `${product.name} | Desejo de Intimidade` : "Produto | Desejo de Intimidade"}
        </title>
        {product ? (
          <meta
            name="description"
            content={
              product.description
                ? `${product.description} Compre na Desejo de Intimidade com entrega discreta.`
                : `${product.name} na Desejo de Intimidade, com entrega 100% discreta para todo o Brasil.`
            }
          />
        ) : null}
        {product ? <link rel="canonical" href={productUrl} /> : null}
        <meta name="rating" content="adult" />
        {product ? <meta property="og:type" content="product" /> : null}
        {product ? <meta property="og:title" content={product.name} /> : null}
        {product?.description ? (
          <meta property="og:description" content={product.description} />
        ) : null}
        {product ? <meta property="og:url" content={productUrl} /> : null}
        {product ? <meta property="og:image" content={ogImage} /> : null}
        {unit !== null ? (
          <meta property="product:price:amount" content={(unit / 100).toFixed(2)} />
        ) : null}
        {unit !== null ? <meta property="product:price:currency" content="BRL" /> : null}
        {productJsonLd ? (
          <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        ) : null}
        {breadcrumbJsonLd ? (
          <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        ) : null}
      </Helmet>
      <SiteHeader />
      <main className={styles.main}>
        <Link to="/#categorias" className={styles.back}>
          <ArrowLeft size={16} /> Voltar à loja
        </Link>

        {loading ? (
          <Skeleton className={styles.skeleton} />
        ) : !validId || !product ? (
          <div className={styles.notFound}>
            <p>Produto não encontrado ou indisponível.</p>
            <Button asChild>
              <Link to="/#categorias">Ver produtos</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className={styles.top}>
              <div className={styles.imageWrap}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className={styles.image} />
                ) : null}
              </div>

              <div className={styles.info}>
                {category ? <p className={styles.eyebrow}>{category.title}</p> : null}
                <h1 className={styles.title}>{product.name}</h1>
                {reviews.data && reviews.data.count > 0 ? (
                  <a href="#avaliacoes" className={styles.ratingLink}>
                    <Stars value={reviews.data.average} />
                    <span>
                      {reviews.data.average.toFixed(1)} ({reviews.data.count}{" "}
                      {reviews.data.count === 1 ? "avaliação" : "avaliações"})
                    </span>
                  </a>
                ) : null}
                {product.description ? (
                  <p className={styles.description}>{product.description}</p>
                ) : null}

                {unit !== null ? (
                  <>
                    <PriceBlock
                      priceCents={unit}
                      compareAtCents={product.compareAtCents}
                      large
                    />
                    {promo ? (
                      <p className={styles.note}>
                        Produto em promoção: o desconto de {PIX_DISCOUNT_PERCENT}% no Pix
                        não se aplica.
                      </p>
                    ) : null}

                    <div className={styles.buy}>
                      <div className={styles.qty} role="group" aria-label="Quantidade">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Diminuir"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        >
                          <Minus size={14} />
                        </Button>
                        <span className={styles.qtyValue}>{quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label="Aumentar"
                          onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                      <Button
                        size="lg"
                        className={styles.glow}
                        onClick={() => {
                          if (product.soldOut) {
                            toast("Produto esgotado");
                            return;
                          }
                          cart.add(product.id, quantity);
                          navigate("/carrinho");
                        }}
                      >
                        <ShoppingBag size={18} /> {product.soldOut ? "Esgotado" : "Comprar agora"}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                          if (product.soldOut) {
                            toast("Produto esgotado");
                            return;
                          }
                          cart.add(product.id, quantity);
                          toast("Adicionado ao carrinho");
                        }}
                      >
                        Adicionar ao carrinho
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className={styles.note}>
                    Este produto não está disponível para compra no site. Fale com
                    a gente pelo WhatsApp.
                  </p>
                )}

                {whatsappNumber ? (
                  <Button asChild variant="ghost" className={styles.doubts}>
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                        `Olá! Tenho uma dúvida sobre o produto "${product.name}".`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={16} /> Tirar dúvidas pelo WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </section>

            <section className={styles.cards}>
              {lineTotal !== null && unit !== null ? (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>
                    <CreditCard size={18} /> Formas de pagamento
                  </h2>
                  {!promo ? (
                    <p className={styles.pixLine}>
                      <strong>
                        {formatCents(pixPriceCents(unit, false) * quantity)}
                      </strong>{" "}
                      no Pix ({PIX_DISCOUNT_PERCENT}% de desconto)
                    </p>
                  ) : null}
                  <p className={styles.small}>No cartão de crédito:</p>
                  <ul className={styles.installments}>
                    {installmentOptions(lineTotal).map((o) => (
                      <li key={o.count}>
                        <span>
                          {o.count}x de {formatCents(o.perCents)}
                        </span>
                        <span className={styles.small}>
                          {o.count === 1 ? "à vista" : `total ${formatCents(lineTotal)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.small}>
                    Parcelas de no mínimo R$ 20,00, em até 3x.
                  </p>
                </div>
              ) : null}

              <div className={styles.card}>
                <h2 className={styles.cardTitle}>
                  <Truck size={18} /> Calcular frete
                </h2>
                <form onSubmit={calculate} className={styles.cepForm}>
                  <Input
                    value={cep}
                    inputMode="numeric"
                    placeholder="Seu CEP"
                    aria-label="CEP para calcular o frete"
                    onChange={(e) => setCep(maskCep(e.target.value))}
                  />
                  <Button type="submit" disabled={quote.isPending}>
                    {quote.isPending ? "Calculando..." : "Calcular"}
                  </Button>
                </form>
                {quote.data ? (
                  quote.data.options.length === 0 ? (
                    <p className={styles.small}>Não encontramos opções para esse CEP.</p>
                  ) : (
                    <ul className={styles.installments}>
                      {quote.data.options.map((o) =>
                        o.method === "correios" ? (
                          <li key={o.service}>
                            <span>
                              {o.service === "sedex" ? "SEDEX" : "PAC"} ·{" "}
                              {formatCents(o.priceCents)}
                            </span>
                            <span className={styles.small}>
                              {o.days > 0 ? `até ${o.days} dias úteis` : ""}
                              {o.estimated ? " · valor estimado" : ""}
                            </span>
                          </li>
                        ) : (
                          <li key="pickup">
                            <span>Retirar em ponto de retirada · Grátis</span>
                            <span className={styles.small}>Porto Alegre · agende pelo WhatsApp após a compra</span>
                          </li>
                        ),
                      )}
                    </ul>
                  )
                ) : (
                  <p className={styles.small}>
                    Digite o CEP para ver o valor e o prazo do frete para a
                    quantidade escolhida.
                  </p>
                )}
              </div>
            </section>

            {specRows.length > 0 ? (
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Especificações</h2>
                <dl className={styles.specs}>
                  {specRows.map((r, i) => (
                    <div key={i} className={styles.specRow}>
                      {r.label ? <dt>{r.label}</dt> : null}
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section id="avaliacoes" className={styles.card}>
              <h2 className={styles.cardTitle}>Avaliações deste produto</h2>
              {reviews.isFetching && !reviews.data ? (
                <Skeleton className={styles.reviewSkeleton} />
              ) : reviews.data && reviews.data.count > 0 ? (
                <>
                  <div className={styles.summary}>
                    <strong className={styles.avg}>
                      {reviews.data.average.toFixed(1)}
                    </strong>
                    <Stars value={reviews.data.average} size={20} />
                    <span className={styles.small}>
                      {reviews.data.count}{" "}
                      {reviews.data.count === 1 ? "avaliação" : "avaliações"}
                    </span>
                  </div>
                  <ul className={styles.reviewList}>
                    {reviews.data.reviews.map((r) => (
                      <li key={r.id} className={styles.review}>
                        <div className={styles.reviewHead}>
                          <Stars value={r.rating} />
                          <strong>{r.displayName}</strong>
                          <span className={styles.small}>
                            {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className={styles.reviewText}>“{r.comment}”</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.small}>
                  Este produto ainda não tem avaliações. Quem comprar e receber
                  pode avaliar pelo link enviado no pedido.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}