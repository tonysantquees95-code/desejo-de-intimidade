import { z } from "zod";

/** A Vênus app manda a lista atual das ideias de post (substitui a anterior). */
export const schema = z.object({
  ideias: z
    .array(
      z.object({
        ref: z.string().min(1).max(40),
        titulo: z.string().min(1).max(200),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        formato: z.string().max(20).default("feed"),
        legenda: z.string().max(2200).default(""),
      }),
    )
    .max(40),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; ideias: number };