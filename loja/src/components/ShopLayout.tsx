import React from "react";
import { Helmet } from "react-helmet";
import { SiteHeader } from "./SiteHeader";
import styles from "./ShopLayout.module.css";

export const ShopLayout = ({
  title,
  subtitle,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}) => (
  <div className={styles.page}>
    <Helmet>
      <title>{title} | Desejo de Intimidade</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <SiteHeader />
    <main className={`${styles.main} ${wide ? styles.wide : ""}`}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      {children}
    </main>
  </div>
);