import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Star } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { OrderProgress } from "../components/OrderProgress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { AuthLoadingState } from "../components/AuthLoadingState";
import { useAuth } from "../helpers/useAuth";
import { formatCents } from "../helpers/formatCents";
import type { OrderDto } from "../helpers/orderDto";
import { getMyOrders } from "../endpoints/shop/orders_GET.schema";
import styles from "./minha-conta.module.css";

/** How the customer sees the order stages (in the order they happen). */
const GROUPS: { id: string; label: string; statuses: OrderDto["status"][] }[] = [
  { id: "awaiting", label: "Aguardando pagamento", statuses: ["awaiting_payment"] },
  { id: "confirmed", label: "Pedido confirmado", statuses: ["paid", "preparing"] },
  { id: "shipped", label: "Enviado / a caminho", statuses: ["shipped"] },
  { id: "delivered", label: "Entregue", statuses: ["delivered"] },
  { id: "canceled", label: "Cancelado", statuses: ["canceled"] },
];

function customerStatusLabel(o: OrderDto): string {
  switch (o.status) {
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "paid":
      return "Pedido confirmado";
    case "preparing":
      return "Em separação";
    case "shipped":
      return o.trackingCode ? "A caminho" : "Enviado";
    case "delivered":
      return "Entregue";
    default:
      return "Cancelado";
  }
}

function OrderCard({ order }: { order: OrderDto }) {
  const thumbs = order.items.slice(0, 4);
  const extra = order.items.length - thumbs.length;
  const names = order.items.map((i) => `${i.quantity}× ${i.name}`).join(" · ");
  return (
    <li className={styles.card}>
      <Link to={`/pedido/${order.id}`} className={styles.cardMain}>
        <div className={styles.cardTop}>
          <div className={styles.cardTitle}>
            <strong>Pedido #{order.id}</strong>
            <span className={styles.meta}>
              {new Date(order.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <Badge variant="secondary">{customerStatusLabel(order)}</Badge>
        </div>

        <div className={styles.thumbs}>
          {thumbs.map((i) => (
            <span key={i.id} className={styles.thumb}>
              {i.imageUrl ? <img src={i.imageUrl} alt={i.name} /> : null}
            </span>
          ))}
          {extra > 0 ? <span className={styles.more}>+{extra}</span> : null}
          <p className={styles.names}>{names}</p>
        </div>

        <OrderProgress status={order.status} compact />
      </Link>
      <div className={styles.foot}>
        <span className={styles.total}>{formatCents(order.totalCents)}</span>
        {order.trackingCode ? (
          <span className={styles.meta}>Rastreio: {order.trackingCode}</span>
        ) : null}
        <span className={styles.footActions}>
          {order.status === "delivered" && !order.reviewed ? (
            <Button asChild size="sm">
              <Link to={`/avaliar/${order.id}`}>
                <Star size={14} /> Avaliar
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to={`/pedido/${order.id}`}>Ver detalhes</Link>
          </Button>
        </span>
      </div>
    </li>
  );
}

export default function MinhaContaPage() {
  const { authState, logout } = useAuth();
  const authenticated = authState.type === "authenticated";
  const { data, isFetching, isError } = useQuery({
    queryKey: ["shop", "orders"],
    queryFn: () => getMyOrders(),
    enabled: authenticated,
  });
  const [tab, setTab] = useState<string | null>(null);

  if (authState.type === "loading") {
    return <AuthLoadingState title="Carregando" />;
  }
  if (authState.type === "unauthenticated") {
    return <Navigate to="/login?next=/minha-conta" replace />;
  }

  const orders = data?.orders ?? [];
  const groupOf = (o: OrderDto) =>
    GROUPS.find((g) => g.statuses.includes(o.status))?.id ?? "confirmed";
  const newest = orders[0];
  const active = tab ?? (newest ? groupOf(newest) : "confirmed");

  return (
    <ShopLayout
      title="Minha conta"
      subtitle={`Olá, ${authState.user.displayName}!`}
    >
      <div className={styles.actions}>
        <Button asChild>
          <Link to="/#categorias">Continuar comprando</Link>
        </Button>
        {authState.user.role === "admin" ? (
          <Button asChild variant="outline">
            <Link to="/admin">Painel da loja</Link>
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => logout()}>
          <LogOut size={16} /> Sair
        </Button>
      </div>

      <h2 className={styles.heading}>Meus pedidos</h2>
      {isFetching && !data ? (
        <Skeleton className={styles.skeleton} />
      ) : isError ? (
        <p className={styles.error}>Não foi possível carregar seus pedidos.</p>
      ) : orders.length === 0 ? (
        <p className={styles.meta}>Você ainda não fez nenhum pedido.</p>
      ) : (
        <Tabs value={active} onValueChange={setTab}>
          <TabsList className={styles.tabsList}>
            {GROUPS.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className={styles.tabsTrigger}>
                {g.label} ({orders.filter((o) => g.statuses.includes(o.status)).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {GROUPS.map((g) => {
            const list = orders.filter((o) => g.statuses.includes(o.status));
            return (
              <TabsContent key={g.id} value={g.id}>
                {list.length === 0 ? (
                  <p className={styles.meta}>Nenhum pedido nesta etapa.</p>
                ) : (
                  <ul className={styles.list}>
                    {list.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </ShopLayout>
  );
}