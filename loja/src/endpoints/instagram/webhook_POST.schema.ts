import { z } from "zod";

/** Eventos do Instagram enviados pela Meta (mensagens do Direct). O corpo é conferido pela assinatura antes de ler. */
export const schema = z.object({
  object: z.string().optional(),
  entry: z.array(z.object({ id: z.string().optional(), messaging: z.array(z.record(z.string(), z.unknown())).optional() }).passthrough()).default([]),
});
export type OutputType = { ok: true };