import React from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { getOrder } from "../endpoints/shop/order_GET.schema";
import { getShippingConfig } from "../endpoints/admin/shipping_config_GET.schema";
import styles from "./admin.etiqueta.module.css";

const formatCep = (cep: string) => {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
};

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
};

export default function EtiquetaPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const valid = Number.isInteger(orderId) && orderId > 0;

  const orderQuery = useQuery({
    queryKey: ["shop", "order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: valid,
  });
  const configQuery = useQuery({
    queryKey: ["admin", "shipping-config"],
    queryFn: () => getShippingConfig(),
  });

  const order = orderQuery.data?.order;
  const sender = configQuery.data?.config.sender;
  const address = order?.shippingAddress ?? null;
  const senderIncomplete =
    !!sender && (!sender.name || !sender.street || !sender.city || !sender.cep);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Etiqueta do pedido ${id ?? ""}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className={styles.toolbar}>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/pedidos">
            <ArrowLeft size={16} /> Voltar aos pedidos
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()} disabled={!order || !address}>
          <Printer size={16} /> Imprimir etiqueta
        </Button>
      </div>

      {senderIncomplete ? (
        <p className={styles.warning}>
          Falta preencher o remetente. Complete em{" "}
          <Link to="/admin/pedidos">Pedidos e entrega</Link> antes de imprimir.
        </p>
      ) : null}
      {order && order.deliveryMethod !== "sedex" ? (
        <p className={styles.warning}>Este pedido é de retirada ou de motoboy e não precisa de etiqueta dos Correios.</p>
      ) : null}

      {!order || !sender ? (
        <Skeleton className={styles.skeleton} />
      ) : address ? (
        <div className={styles.sheet}>
          <section className={styles.dest}>
            <h2 className={styles.tag}>Destinatário</h2>
            <p className={styles.destName}>{order.customerName}</p>
            <p className={styles.line}>
              {address.street}, {address.number}
              {address.complement ? ` - ${address.complement}` : ""}
            </p>
            <p className={styles.line}>{address.neighborhood}</p>
            <p className={styles.line}>
              {address.city} - {address.state}
            </p>
            <p className={styles.cep}>CEP {formatCep(address.cep)}</p>
            <p className={styles.small}>Tel.: {formatPhone(order.customerPhone)}</p>
          </section>

          <section className={styles.from}>
            <h2 className={styles.tag}>Remetente</h2>
            <p className={styles.fromName}>{sender.name || "—"}</p>
            <p className={styles.small}>
              {sender.street}
              {sender.number ? `, ${sender.number}` : ""}
              {sender.complement ? ` - ${sender.complement}` : ""}
            </p>
            <p className={styles.small}>
              {sender.neighborhood}
              {sender.neighborhood ? " · " : ""}
              {sender.city}
              {sender.state ? ` - ${sender.state}` : ""}
            </p>
            <p className={styles.small}>
              {sender.cep ? `CEP ${formatCep(sender.cep)}` : ""}
            </p>
          </section>

          <p className={styles.footer}>Pedido nº {order.id} · SEDEX</p>
        </div>
      ) : (
        <p className={styles.warning}>Este pedido não tem endereço de entrega.</p>
      )}

      <p className={styles.help}>
        Imprima em papel adesivo ou em papel comum e cole bem na caixa. Leve a
        caixa a uma agência dos Correios para postar. Na agência, informe o
        serviço SEDEX e peça o código de rastreio, depois registre-o neste
        pedido em “Pedidos e entrega”.
      </p>
    </div>
  );
}