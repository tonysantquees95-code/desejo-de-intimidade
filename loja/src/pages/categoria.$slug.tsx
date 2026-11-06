import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ProductCard } from "../components/ProductCard";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useCatalog } from "../helpers/useCatalog";
import { productCategories } from "../helpers/productCategories";
import { SITE_URL, absoluteUrl } from "../helpers/siteUrl";
import styles from "./categoria.module.css";

export default function CategoriaPage() {
  const { slug } = useParams<{ slug: string }>();
  const category = productCategories.find((c) => c.slug === slug) ?? null;
  const { data, isFetching } = useCatalog();
  const products = (data?.products ?? []).filter((p) => p.category === category?.id);
  const url = `${SITE_URL}/categoria/${slug}`;

  const jsonLd = category
    ? [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: category.title, item: url },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: category.title,
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/produto/${p.id}`,
            name: p.name,
            ...(p.imageUrl ? { image: absoluteUrl(p.imageUrl) } : {}),
          })),
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {category
            ? `${category.title} | Sex Shop Desejo de Intimidade`
            : "Categoria | Desejo de Intimidade"}
        </title>
        {category ? (
          <meta
            name="description"
            content={`${category.text} Compre com entrega 100% discreta para todo o Brasil.`}
          />
        ) : null}
        {category ? <link rel="canonical" href={url} /> : null}
        <meta name="rating" content="adult" />
        {category ? <meta property="og:type" content="website" /> : null}
        {category ? <meta property="og:title" content={`${category.title} | Desejo de Intimidade`} /> : null}
        {category ? <meta property="og:description" content={category.text} /> : null}
        {category ? <meta property="og:url" content={url} /> : null}
        <meta
          property="og:image"
          content="https://desejo-de-intimidade.tonysantquees95.workers.dev/_cdn/static/86d30161-7ae8-424f-a57b-78ebd06a5975-logo-og.jpg"
        />
        {jsonLd.map((block, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(block)}
          </script>
        ))}
      </Helmet>
      <SiteHeader />
      <main className={styles.main}>
        {!category ? (
          <div className={styles.notFound}>
            <p>Categoria não encontrada.</p>
            <Button asChild>
              <Link to="/#categorias">Ver categorias</Link>
            </Button>
          </div>
        ) : (
          <>
            <nav aria-label="Você está em" className={styles.breadcrumb}>
              <Link to="/">Início</Link> / <span>{category.title}</span>
            </nav>
            <h1 className={styles.title}>{category.title}</h1>
            <p className={styles.lead}>{category.text}</p>

            {isFetching && !data ? (
              <Skeleton className={styles.skeleton} />
            ) : products.length === 0 ? (
              <p className={styles.lead}>Novidades chegando em breve nesta categoria.</p>
            ) : (
              <ul className={styles.grid}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} whatsappNumber={data?.whatsappNumber ?? ""} />
                ))}
              </ul>
            )}

            <nav aria-label="Outras categorias" className={styles.others}>
              <h2 className={styles.othersTitle}>Outras categorias</h2>
              <ul className={styles.otherList}>
                {productCategories
                  .filter((c) => c.id !== category.id)
                  .map((c) => (
                    <li key={c.id}>
                      <Link to={`/categoria/${c.slug}`}>{c.title}</Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </>
        )}
      </main>
    </div>
  );
}