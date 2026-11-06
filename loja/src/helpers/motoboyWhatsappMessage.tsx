import type { OrderDto } from "./orderDto";

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

const formatCep = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : raw;
};

/**
 * Mensagem que o cliente manda para a loja no WhatsApp depois de comprar com entrega por motoboy
 * (botão "Avisar a loja da compra"). Devolve null se o pedido não tiver endereço.
 */
export function motoboyWhatsappMessage(
  order: Pick<OrderDto, "customerName" | "customerPhone" | "shippingAddress">,
): string | null {
  const a = order.shippingAddress;
  if (!a) return null;
  const rua = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""}`;
  return [
    "Olá, Desejo de Intimidade! Acabei de fazer um pedido no site e escolhi a entrega via Motoboy. Aqui estão os dados para envio:",
    "",
    `👤 *Cliente:* ${order.customerName}`,
    `📞 *Telefone:* ${formatPhone(order.customerPhone)}`,
    "",
    "📍 *Endereço de Entrega:*",
    rua,
    `${a.neighborhood} - ${a.city}/${a.state}`,
    formatCep(a.cep),
    "",
    "Aguardo a confirmação para liberação do entregador!",
  ].join("\n");
}
