import type { OrderDto } from "./orderDto";
import { formatCents } from "./formatCents";

/**
 * Builds the wa.me link the owner taps to tell the customer about the current
 * status of the order. Returns null when there is nothing to say yet.
 */
export function buildCustomerWhatsappUrl(
  order: OrderDto,
  siteUrl: string,
): string | null {
  const digits = order.customerPhone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  const orderLink = `${siteUrl}/pedido/${order.id}`;
  const lines: string[] = [];

  switch (order.status) {
    case "paid":
      lines.push(
        `Olá, ${first}! Recebemos o pagamento do seu pedido #${order.id} (${formatCents(order.totalCents)}). Já estamos separando tudo com muito cuidado e discrição. 💖`,
        `Acompanhe aqui: ${orderLink}`,
      );
      break;
    case "preparing":
      lines.push(
        `Olá, ${first}! Seu pedido #${order.id} está sendo separado e embalado em caixa discreta. Em breve ele segue para o envio. 💖`,
        `Acompanhe aqui: ${orderLink}`,
      );
      break;
    case "shipped":
      lines.push(
        `Olá, ${first}! Seu pedido #${order.id} foi enviado! 📦`,
        order.trackingCode
          ? `Código de rastreio: ${order.trackingCode}`
          : "Assim que o código de rastreio sair, ele aparece na página do pedido.",
        `Acompanhe aqui: ${orderLink}`,
      );
      break;
    case "delivered":
      lines.push(
        `Olá, ${first}! Seu pedido #${order.id} foi entregue. Esperamos que você ame! 💖`,
        `Conta pra gente o que achou do produto e do atendimento (leva 1 minuto): ${siteUrl}/avaliar/${order.id}`,
      );
      break;
    case "canceled":
      lines.push(
        `Olá, ${first}! Seu pedido #${order.id} foi cancelado. Se houve pagamento, o valor será devolvido pelo mesmo meio de pagamento. Qualquer dúvida, é só responder aqui.`,
      );
      break;
    default:
      return null;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}