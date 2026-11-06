import { apiRequest } from "../../helpers/apiRequest";
import type { OrderStatus, PaymentMethod } from "../../helpers/schema";

export type SolicitacaoTroca = {
  id: number;
  orderId: number;
  tipo: string;
  preferencia: string;
  itens: string;
  descricao: string;
  estado: string;
  resposta: string | null;
  criado: Date;
  atualizado: Date;
  customerName: string;
  customerPhone: string;
  orderStatus: OrderStatus;
  orderUpdatedAt: Date;
  totalCents: number;
  paymentMethod: PaymentMethod;
};

export type OutputType = { solicitacoes: SolicitacaoTroca[] };

export const getAdminTrocas = () => apiRequest<OutputType>("/_api/admin/trocas", { method: "GET" });