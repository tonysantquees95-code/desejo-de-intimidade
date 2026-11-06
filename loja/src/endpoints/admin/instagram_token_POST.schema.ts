import { z } from "zod";

/** Enviado pela Vênus app quando o Instagram da loja é conectado (o token fica só no servidor, nunca volta para a tela). */
export const schema = z.object({
  token: z.string().min(20).max(1000),
  contaId: z.string().max(40).default(""),
  usuario: z.string().max(80).default(""),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };