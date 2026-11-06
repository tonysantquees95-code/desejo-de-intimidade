import { z } from "zod";

/** A Vênus app conta como foi o pedido (feito ou erro), com a imagem que ela montou. */
export const schema = z.object({
  id: z.number().int(),
  ok: z.boolean(),
  resultado: z.string().max(500),
  imagemUrl: z.string().max(1000).nullable().optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };