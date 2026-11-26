import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle2, Clock, XCircle, MessageCircle, CalendarClock } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { AvisoPagamento } from "../components/RodapeVetorial";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { OrderProgress } from "../components/OrderProgress";
import { AuthLoadingState } from "../components/AuthLoadingState";
import { useAuth } from "../helpers/useAuth";
import { useCatalog } from "../helpers/useCatalog";
import { formatCents } from "../helpers/formatCents";
import { orderStatusLabels } from "../helpers/orderDto";
import { motoboyWhatsappMessage } from "../helpers/motoboyWhatsappMessage";
import { toast } from "../helpers/toast";
import { getOrder } from "../endpoints/shop/order_GET.schema";
import styles from "./pedido.module.css";

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { authState } = useAuth();
  const authenticated = authState.type === "authenticated";
  const validId = Number.isInteger(orderId) && orderId > 0;

  const { data, isError, error } = useQuery({
    queryKey: ["shop", "order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: authenticated && validId,
    // floot-polling-ok: short-lived Pix confirmation. Stops as soon as the status leaves "awaiting_payment".
    refetchInterval: (query) =>
      query.state.data?.order.status === "awaiting_payment" ? 5000 : false,
  });

  const catalog = useCatalog();

  if (authState.type === "loading") {
    return <AuthLoadingState title="Carregando" />;
  }
  if (authState.type === "unauthenticated") {
    return <Navigate to={`/login?next=/pedido/${id}`} replace />;
  }

  const whatsappNumber = catalog.data?.whatsappNumber ?? "";
  const order = data?.order;
  const whatsappUrl = (() => {
    if (!order || !whatsappNumber) return null;
    const itemsText = order.items
      .map((i) => `- ${i.quantity}x ${i.name}`)
      .join("\n");
    const paid = order.status !== "awaiting_payment";
    const agendar = paid && order.deliveryMethod === "pickup";
    const text = [
      `Olá! Fiz o pedido #${order.id} no site da Desejo de Intimidade${paid ? " e o pagamento já foi confirmado" : ""}.`,
      ...(agendar ? ["Quero agendar a retirada: qual o local e quais dias e horários estão disponíveis?"] : []),
      "",
      "Itens:",
      itemsText,
      "",
      `Total: ${formatCents(order.totalCents)} (${order.paymentMethod === "pix" ? "Pix" : order.paymentMethod === "infinitepay" ? "InfinitePay" : `cartão em ${order.installments}x`})`,
      `Entrega: ${order.deliveryMethod === "pickup" ? "retirada em ponto de retirada (a agendar)" : order.deliveryMethod === "motoboy" ? "Motoboy" : "SEDEX"}`,
      `Nome: ${order.customerName}`,
    ].join("\n");
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  })();
  // Pedido por motoboy: o botão "Avisar a loja da compra" já leva os dados de entrega prontos.
  const motoboyUrl = (() => {
    if (!order || order.deliveryMethod !== "motoboy" || !whatsappNumber) return null;
    const text = motoboyWhatsappMessage(order);
    return text ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}` : null;
  })();
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  return (
    <ShopLayout title={order ? `Pedido #${order.id}` : "Pedido"}>
      {!validId || isError ? (
        <p className={styles.error}>
          {error instanceof Error ? error.message : "Pedido não encontrado."}
        </p>
      ) : !order ? (
        <Skeleton className={styles.skeleton} />
      ) : (
        <>
          {order.status === "awaiting_payment" && order.paymentUrl ? (
            <section className={styles.banner}>
              <div className={styles.bannerHead}>
                <Clock size={22} /> <strong>Aguardando o pagamento</strong>
              </div>
              <p className={styles.hint}>
                Pague na página segura da InfinitePay, com Pix (5% de desconto nos
                produtos que não estão em promoção) ou cartão em até 3x. Se você
                já pagou, esta página atualiza sozinha em instantes.
                {order.pixExpiresAt
                  ? ` O link vale até ${new Date(order.pixExpiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
                  : ""}
              </p>
              <AvisoPagamento />
              <a href={order.paymentUrl}>
                <Button>Pagar agora</Button>
              </a>
            </section>
          ) : order.status === "awaiting_payment" ? (
            <section className={styles.banner}>
              <div className={styles.bannerHead}>
                <Clock size={22} /> <strong>Pagamento em análise</strong>
              </div>
              <p className={styles.hint}>
                Assim que o pagamento for confirmado, o pedido muda para “Pago”.
              </p>
            </section>
          ) : order.status === "canceled" ? (
            <section className={`${styles.banner} ${styles.bad}`}>
              <div className={styles.bannerHead}>
                <XCircle size={22} /> <strong>Pedido cancelado</strong>
              </div>
              <p className={styles.hint}>
                O pagamento não foi concluído. Você pode fazer um novo pedido.
              </p>
            </section>
          ) : (
            <section className={`${styles.banner} ${styles.good}`}>
              <div className={styles.bannerHead}>
                <CheckCircle2 size={22} />{" "}
                <strong>{orderStatusLabels[order.status]}</strong>
              </div>
              {order.trackingCode ? (
                <p className={styles.hint}>
                  Código de rastreio: <strong>{order.trackingCode}</strong>
                </p>
              ) : (
                <p className={styles.hint}>
                  {order.deliveryMethod === "pickup"
                    ? "Obrigada pela compra! Agora é só agendar a retirada."
                    : order.deliveryMethod === "motoboy"
                      ? "Obrigada pela compra! Avise a loja para liberar o entregador."
                      : "Obrigada pela compra! Avisaremos sobre o envio."}
                </p>
              )}
            </section>
          )}

          {order.deliveryMethod === "pickup" &&
          order.status !== "canceled" &&
          order.status !== "awaiting_payment" &&
          order.status !== "delivered" ? (
            <section className={`${styles.banner} ${styles.agendar}`}>
              <div className={styles.bannerHead}>
                <CalendarClock size={22} /> <strong>Agende sua retirada</strong>
              </div>
              <p className={styles.hint}>
                Seu pedido é retirado em um ponto de retirada em Porto Alegre. O
                local, o dia e o horário são combinados pelo WhatsApp:{" "}
                <strong>a retirada só acontece depois do agendamento.</strong>
              </p>
              {whatsappUrl ? (
                <Button asChild>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={16} /> Agendar retirada no WhatsApp
                  </a>
                </Button>
              ) : (
                <p className={styles.hint}>
                  Fale com a loja pelos nossos canais de atendimento para agendar.
                </p>
              )}
            </section>
          ) : motoboyUrl && order.status !== "canceled" ? (
            <section className={`${styles.banner} ${styles.agendar}`}>
              <div className={styles.bannerHead}>
                <MessageCircle size={22} /> <strong>Entrega Expressa via Motoboy</strong>
              </div>
              <p className={styles.hint}>
                Toque no botão para avisar a loja da sua compra. A mensagem já vai pronta com o
                seu nome, telefone e endereço de entrega. A loja confirma e libera o entregador.
              </p>
              <Button asChild>
                <a href={motoboyUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={16} /> Avisar a loja da compra
                </a>
              </Button>
            </section>
          ) : whatsappUrl && order.status !== "canceled" ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                {order.status === "awaiting_payment"
                  ? "Ficou com dúvida?"
                  : "Avise a loja pelo WhatsApp"}
              </h2>
              <p className={styles.hint}>
                {order.status === "awaiting_payment"
                  ? "Fale com a gente pelo WhatsApp se precisar de ajuda com o pagamento."
                  : "Envie a confirmação do pedido para a loja e ele é separado mais rápido. A mensagem já vai pronta com os itens comprados."}
              </p>
              <Button asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={16} />{" "}
                  {order.status === "awaiting_payment"
                    ? "Falar com a loja"
                    : "Enviar confirmação no WhatsApp"}
                </a>
              </Button>
            </section>
          ) : null}

          <section className={styles.progressCard} aria-label="Andamento do pedido">
            <OrderProgress status={order.status} />
          </section>

          {order.status === "delivered" && !order.reviewed ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Como foi sua compra?</h2>
              <p className={styles.hint}>
                Avalie os produtos e o atendimento. Leva 1 minuto e ajuda
                outras pessoas.
              </p>
              <Button asChild>
                <Link to={`/avaliar/${order.id}`}>Avaliar minha compra</Link>
              </Button>
            </section>
          ) : null}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Itens</h2>
            <ul className={styles.items}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.itemRow}>
                  <span className={styles.itemThumb}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : null}
                  </span>
                  <span className={styles.itemInfo}>
                    {item.productId ? (
                      <Link to={`/produto/${item.productId}`} className={styles.itemName}>
                        {item.name}
                      </Link>
                    ) : (
                      <span className={styles.itemName}>{item.name}</span>
                    )}
                    <small>
                      {item.quantity}× {formatCents(item.unitPriceCents)}
                    </small>
                  </span>
                  <strong>{formatCents(item.unitPriceCents * item.quantity)}</strong>
                </li>
              ))}
            </ul>
            <div className={styles.line}>
              <span>Subtotal</span>
              <span>{formatCents(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 ? (
              <div className={styles.line}>
                <span>Desconto Pix</span>
                <span>-{formatCents(order.discountCents)}</span>
              </div>
            ) : null}
            <div className={styles.line}>
              <span>Frete</span>
              <span>{order.shippingCents === 0 ? "Grátis" : formatCents(order.shippingCents)}</span>
            </div>
            <div className={`${styles.line} ${styles.total}`}>
              <span>Total</span>
              <span>{formatCents(order.totalCents)}</span>
            </div>
            <p className={styles.hint}>
              Pagamento:{" "}
              {order.paymentMethod === "pix"
                ? "Pix"
                : `Cartão de crédito em ${order.installments}x`}
            </p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Entrega</h2>
            {order.deliveryMethod === "pickup" ? (
              <p className={styles.hint}>
                Retirada em ponto de retirada em Porto Alegre, com dia e horário
                agendados pelo WhatsApp.
              </p>
            ) : order.shippingAddress ? (
              <p className={styles.hint}>
                {order.deliveryMethod === "motoboy" ? "Motoboy (até 24h)" : "SEDEX"} para {order.customerName}: {order.shippingAddress.street},{" "}
                {order.shippingAddress.number}
                {order.shippingAddress.complement ? ` - ${order.shippingAddress.complement}` : ""},{" "}
                {order.shippingAddress.neighborhood}, {order.shippingAddress.city}/
                {order.shippingAddress.state}, CEP {order.shippingAddress.cep}.
              </p>
            ) : null}
          </section>

          <Link to="/minha-conta" className={styles.back}>
            Ver todos os meus pedidos
          </Link>
          {order.status === "shipped" || order.status === "delivered" ? (
            <Link to="/trocas#solicitar" className={styles.back}>
              Problema com o pedido? Trocas e devoluções
            </Link>
          ) : null}
        </>
      )}
    </ShopLayout>
  );
}