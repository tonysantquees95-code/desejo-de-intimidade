import type {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
} from "./schema";
import type { Address } from "./addressSchema";

export type OrderItemDto = {
  id: number;
  productId: number | null;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
};

export type OrderDto = {
  id: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** Pix discount already subtracted from totalCents */
  discountCents: number;
  installments: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: Address | null;
  pixQrText: string | null;
  pixExpiresAt: Date | null;
  trackingCode: string | null;
  shippingService: string | null;
  shippingDays: number | null;
  /** true once the shipment exists in Melhor Envio */
  shipmentCreated: boolean;
  shipmentError: string | null;
  /** last status the owner already told the customer about on WhatsApp */
  notifiedStatus: string | null;
  /** true once the customer sent a review for this order */
  reviewed: boolean;
  paidAt: Date | null;
  createdAt: Date;
  items: OrderItemDto[];
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separação",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};