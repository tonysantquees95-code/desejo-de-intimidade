import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({
  cep: z.string().trim().max(12).nullable(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(30),
});

export type InputType = z.infer<typeof schema>;

export type ShippingOption =
  | {
      method: "correios";
      service: "sedex" | "pac";
      priceCents: number;
      days: number;
      /** true when the value comes from the fallback table, not a live quote */
      estimated: boolean;
      /** Preço cheio, quando o frete grátis (com teto) abateu parte ou tudo. */
      originalPriceCents?: number;
    }
  | { method: "motoboy"; priceCents: number; days: 1; km: number }
  | { method: "pickup"; priceCents: 0; address: string; note: string };

export type OutputType = {
  options: ShippingOption[];
  /** Why the motoboy is not offered for this CEP (null when offered or not applicable). */
  motoboyNote: string | null;
};

export const postShippingQuote = (body: InputType) =>
  apiRequest<OutputType>("/_api/shop/shipping_quote", {
    method: "POST",
    body: schema.parse(body),
  });