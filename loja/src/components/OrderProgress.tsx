import React from "react";
import { Check, XCircle } from "lucide-react";
import type { OrderStatus } from "../helpers/schema";
import styles from "./OrderProgress.module.css";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "awaiting_payment", label: "Pedido feito" },
  { status: "paid", label: "Pagamento confirmado" },
  { status: "preparing", label: "Em separação" },
  { status: "shipped", label: "Enviado" },
  { status: "delivered", label: "Entregue" },
];

/** Step-by-step progress of an order (like the big stores do). */
export const OrderProgress = ({
  status,
  compact,
}: {
  status: OrderStatus;
  compact?: boolean;
}) => {
  if (status === "canceled") {
    return (
      <div className={styles.canceled}>
        <XCircle size={16} /> Pedido cancelado
      </div>
    );
  }
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className={`${styles.steps} ${compact ? styles.compact : ""}`}>
      {STEPS.map((s, i) => (
        <li
          key={s.status}
          className={styles.step}
          data-state={i < current ? "done" : i === current ? "current" : "todo"}
        >
          <span className={styles.dot}>
            {i < current ? <Check size={12} /> : i + 1}
          </span>
          <span className={styles.label}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
};