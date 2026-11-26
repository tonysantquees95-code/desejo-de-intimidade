import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";
import { addressSchema } from "../../helpers/addressSchema";
import { isValidCpf } from "../../helpers/isValidCpf";
import type { OrderStatus } from "../../helpers/schema";

export const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1, "O carrinho está vazio")
    .max(30),
  customer: z.object({
    name: z.string().trim().min(3, "Informe seu nome completo").max(120),
    cpf: z.string().refine(isValidCpf, { message: "CPF inválido" }),
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 10 || v.length === 11, {
        message: "Telefone inválido (com DDD)",
      }),
  }),
  deliveryMethod: z.enum(["sedex", "pickup", "motoboy"]),
  // Which Correios service the customer picked (required when deliveryMethod is "sedex")
  shippingService: z.enum(["sedex", "pac"]).nullable(),
  address: addressSchema.nullable(),
});

export type InputType = z.input<typeof schema>;
export type OutputType = {
  orderId: number;
  status: OrderStatus;
  /** Página de pagamento da InfinitePay (Pix ou cartão). */
  paymentUrl: string;
};

export const postOrderCreate = (body: InputType) =>
  apiRequest<OutputType>("/_api/shop/order_create", {
    method: "POST",
    body,
  });