import { z } from "zod";

/** Enviado pela Vênus app quando o dono muda as regras de venda (Ajustes → Site, ramo e regras de venda). */
export const schema = z.object({
  regras: z.record(z.string(), z.unknown()),
  texto: z.string().max(4000).optional(),
  respostas: z
    .array(z.object({ id: z.string().min(1).max(40), pergunta: z.string().max(300), resposta: z.string().max(1500) }))
    .max(30)
    .optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; respostas: number };