import { z } from "zod";

// Called by Mercado Pago (plain JSON, not superjson). Only the payment id is read.
export const schema = z
  .object({
    type: z.string().optional(),
    data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  })
  .passthrough();

export type OutputType = { ok: true };