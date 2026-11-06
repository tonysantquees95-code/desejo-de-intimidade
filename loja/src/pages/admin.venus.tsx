import React from "react";
import { Helmet } from "react-helmet";
import { AdminNav } from "../components/AdminNav";
import { VenusLoja } from "../components/VenusLoja";
import { InstalarApp } from "../components/InstalarApp";
import styles from "./admin.module.css";
import local from "./admin.venus.module.css";

/**
 * Vênus da Loja: a assistente de voz da loja, dentro do painel.
 * Feita para o celular (inclusive iPhone): no Safari, Compartilhar → Adicionar à Tela de Início.
 */
export default function AdminVenusPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Vênus da Loja</title>
        <link rel="manifest" href="/venus-loja-app.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Vênus Loja" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </Helmet>
      <AdminNav title="Vênus da Loja" current="/admin/venus" />
      <main className={local.pagina}>
        <InstalarApp rotulo="Instalar a Vênus no celular" nome="Vênus da Loja" apk={null} className={local.instalar} />
        <VenusLoja />
      </main>
    </div>
  );
}
