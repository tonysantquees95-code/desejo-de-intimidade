import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessageCircle, Printer } from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { AdminNav } from "../components/AdminNav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { toast } from "../helpers/toast";
import { formatCents } from "../helpers/formatCents";
import {
  orderStatusLabels,
  type OrderDto,
} from "../helpers/orderDto";
import { OrderStatusArrayValues, type OrderStatus } from "../helpers/schema";
import { buildCustomerWhatsappUrl } from "../helpers/customerWhatsappMessage";
import { getAdminOrders } from "../endpoints/admin/orders_GET.schema";
import { postOrderUpdate } from "../endpoints/admin/order_update_POST.schema";
import { postShipmentCreate } from "../endpoints/admin/shipment_create_POST.schema";
import { postShipmentLabel } from "../endpoints/admin/shipment_label_POST.schema";
import { postOrderCancel } from "../endpoints/admin/order_cancel_POST.schema";
import { postOrderNotified } from "../endpoints/admin/order_notified_POST.schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/Dialog";
import styles from "./admin.module.css";
import local from "./admin.pedidos.module.css";

/** Tab order: what needs attention first. */
const TAB_ORDER: { status: OrderStatus; label: string }[] = [
  { status: "awaiting_payment", label: "1. Aguardando pagamento" },
  { status: "paid", label: "2. Pagamento confirmado" },
  { status: "preparing", label: "3. Em separação" },
  { status: "shipped", label: "4. Enviados" },
  { status: "delivered", label: "5. Entregues" },
  { status: "canceled", label: "Cancelados" },
];

function OrderRow({ order }: { order: OrderDto }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.trackingCode ?? "");

  useEffect(() => {
    setStatus(order.status);
    setTracking(order.trackingCode ?? "");
  }, [order.status, order.trackingCode]);

  const update = useMutation({
    mutationFn: postOrderUpdate,
    onSuccess: () => {
      toast("Pedido atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const createShipment = useMutation({
    mutationFn: postShipmentCreate,
    onSuccess: (result) => {
      if (result.shipmentCreated) toast("Envio criado no Melhor Envio");
      else toast.error(result.error ?? "Não foi possível criar o envio.");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => toast.error(err.message),
  });
  const label = useMutation({
    mutationFn: postShipmentLabel,
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => toast.error(err.message),
  });

  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelOrder = useMutation({
    mutationFn: postOrderCancel,
    onSuccess: (result) => {
      setConfirmCancel(false);
      toast(
        result.refunded
          ? "Pedido cancelado e valor estornado ao cliente"
          : result.manualRefund
            ? "Pedido cancelado. Faça o estorno no app da InfinitePay."
            : "Pedido cancelado",
      );
      if (result.shipmentRemoved === false) {
        toast.error("Remova o envio manualmente no carrinho do Melhor Envio.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => {
      setConfirmCancel(false);
      toast.error(err.message);
    },
  });

  const notified = useMutation({
    mutationFn: postOrderNotified,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
  });
  const pendingNotify = order.notifiedStatus !== order.status;
  const customerWhatsappUrl =
    order.status === "awaiting_payment"
      ? null
      : buildCustomerWhatsappUrl(order, window.location.origin);

  const address = order.shippingAddress;
  return (
    <li className={local.order}>
      <div className={local.orderHead}>
        <strong>
          Pedido #{order.id} · {formatCents(order.totalCents)}
        </strong>
        <Badge variant="secondary">{orderStatusLabels[order.status]}</Badge>
      </div>
      <p className={local.meta}>
        {new Date(order.createdAt).toLocaleString("pt-BR")} · {order.customerName} ·{" "}
        {order.customerEmail} · {order.customerPhone}
      </p>
      <ul className={local.items}>
        {order.items.map((i) => (
          <li key={i.id}>
            {i.quantity}× {i.name} ({formatCents(i.unitPriceCents)})
          </li>
        ))}
      </ul>
      <p className={local.meta}>
        {order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "infinitepay" ? "InfinitePay (aguardando)" : `Cartão em ${order.installments}x`} ·{" "}
        {order.deliveryMethod === "pickup"
          ? "Retirada em ponto de retirada (agendar pelo WhatsApp)"
          : address
            ? `${order.deliveryMethod === "motoboy" ? "Motoboy (até 24h)" : order.shippingService === "pac" ? "PAC" : "SEDEX"} (${formatCents(order.shippingCents)}): ${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ""}, ${address.neighborhood}, ${address.city}/${address.state}, CEP ${address.cep}`
            : "SEDEX"}
      </p>
      {order.deliveryMethod === "sedex" && order.status !== "canceled" ? (
        <div className={local.shipment}>
          {order.shipmentError ? (
            <p className={local.shipmentError}>
              Não foi possível criar o envio no Melhor Envio: {order.shipmentError}
            </p>
          ) : null}
          {order.shipmentCreated ? (
            <p className={local.meta}>
              {order.trackingCode
                ? `Rastreio ${order.trackingCode} (a cliente já vê no pedido).`
                : "Envio criado no Melhor Envio. Pague a etiqueta lá; o código de rastreio aparece aqui sozinho."}
            </p>
          ) : null}
          <div className={local.shipmentActions}>
            {order.shipmentCreated ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <a href="https://melhorenvio.com.br/carrinho" target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} /> Pagar no Melhor Envio
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={label.isPending}
                  onClick={() => label.mutate({ orderId: order.id })}
                >
                  <Printer size={16} /> Etiqueta oficial (PDF)
                </Button>
              </>
            ) : ["paid", "preparing"].includes(order.status) ? (
              <Button
                size="sm"
                variant="outline"
                disabled={createShipment.isPending}
                onClick={() => createShipment.mutate({ orderId: order.id })}
              >
                Criar envio no Melhor Envio
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {["paid", "preparing", "shipped"].includes(order.status) ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmCancel(true)}
          >
            Cancelar e estornar
          </Button>
          <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar e estornar o pedido #{order.id}?</DialogTitle>
                <DialogDescription>
                  O pedido fica como cancelado e o estoque volta. Isso não pode
                  ser desfeito. Se o pedido foi pago pela InfinitePay, o estorno
                  de {formatCents(order.totalCents)} ao cliente você faz no app
                  da InfinitePay (a loja não consegue estornar sozinha).
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  disabled={cancelOrder.isPending}
                  onClick={() => cancelOrder.mutate({ orderId: order.id })}
                >
                  {cancelOrder.isPending ? "Estornando..." : "Cancelar e estornar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
      {customerWhatsappUrl ? (
        <div>
          <Button
            asChild
            size="sm"
            variant={pendingNotify ? "primary" : "outline"}
          >
            <a
              href={customerWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => notified.mutate({ orderId: order.id })}
            >
              <MessageCircle size={16} />{" "}
              {pendingNotify
                ? `Avisar cliente: ${orderStatusLabels[order.status]}`
                : "Avisar cliente de novo"}
            </a>
          </Button>
        </div>
      ) : null}
      <div className={local.controls}>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OrderStatusArrayValues.map((s) => (
              <SelectItem key={s} value={s}>
                {orderStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Código de rastreio"
          value={tracking}
          placeholder="Código de rastreio"
          onChange={(e) => setTracking(e.target.value)}
        />
        <Button
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({ id: order.id, status, trackingCode: tracking.trim() || null })
          }
        >
          Salvar
        </Button>
        {order.deliveryMethod === "sedex" &&
        ["paid", "preparing", "shipped", "delivered"].includes(order.status) ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/admin/etiqueta/${order.id}`}>
              <Printer size={16} /> Etiqueta
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default function AdminPedidosPage() {
  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => getAdminOrders(),
  });
  const [tab, setTab] = useState<OrderStatus | null>(null);

  const orders = data?.orders ?? [];
  const countOf = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  // Open on the first tab that has orders (pagos first), until the user picks one.
  const active: OrderStatus =
    tab ??
    (countOf("paid") > 0
      ? "paid"
      : (TAB_ORDER.find((t) => countOf(t.status) > 0)?.status ?? "awaiting_payment"));

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Pedidos | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Pedidos" current="/admin/pedidos" />
      <main className={styles.main}>
        {isFetching && !data ? (
          <Skeleton className={local.skeleton} />
        ) : isError ? (
          <p className={styles.error}>Não foi possível carregar os pedidos.</p>
        ) : orders.length === 0 ? (
          <p className={styles.empty}>Nenhum pedido ainda.</p>
        ) : (
          <Tabs value={active} onValueChange={(v) => setTab(v as OrderStatus)}>
            <TabsList className={local.tabsList}>
              {TAB_ORDER.map((t) => (
                <TabsTrigger key={t.status} value={t.status} className={local.tabsTrigger}>
                  {t.label} ({countOf(t.status)})
                </TabsTrigger>
              ))}
            </TabsList>
            {TAB_ORDER.map((t) => {
              const list = orders.filter((o) => o.status === t.status);
              return (
                <TabsContent key={t.status} value={t.status}>
                  {list.length === 0 ? (
                    <p className={styles.empty}>Nenhum pedido nesta aba.</p>
                  ) : (
                    <ul className={local.orders}>
                      {list.map((o) => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </ul>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </main>
    </div>
  );
}