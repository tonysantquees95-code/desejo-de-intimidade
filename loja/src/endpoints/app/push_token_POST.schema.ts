import { z } from "zod";

/** Chamado pelo app Android (web/contas-ponte.js) com JSON simples: { token }. */
export const schema = z.object({
  token: z.string().trim().min(20).max(4096),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };
