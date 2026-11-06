import React from "react";
import { Helmet } from "react-helmet";
import { AdminNav } from "../components/AdminNav";
import { ShippingSettingsCard } from "../components/ShippingSettingsCard";
import styles from "./admin.module.css";

export default function AdminEntregaPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Entrega | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Entrega e retirada" current="/admin/entrega" />
      <main className={styles.main}>
        <ShippingSettingsCard />
      </main>
    </div>
  );
}