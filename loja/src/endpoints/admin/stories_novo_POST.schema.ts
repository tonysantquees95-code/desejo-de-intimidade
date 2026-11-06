import { z } from "zod";

/** Chamado pelo app Vênus quando um story do dia fica pronto (ou já saiu sozinho de manhã). */
export const schema = z.object({
  turno: z.enum(["manha", "tarde"]),
  titulo: z.string().min(1).max(120),
  texto: z.string().max(400).default(""),
  pergunta: z.string().max(120).nullable().optional(),
  imagemUrl: z.string().min(1).max(1000),
  enquete: z.boolean().default(false),
  publicadoInstagram: z.boolean().default(false),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { id: number; avisados: number };