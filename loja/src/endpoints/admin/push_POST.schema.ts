import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({
  acao: z.enum(["salvar", "remover"]),
  assinatura: z.record(z.string(), z.unknown()).optional(),
  identidade: z.string().max(2000).optional(),
  antiga: z.string().max(2000).nullable().optional(),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: boolean };

export const postAdminPush = (body: InputType) => apiRequest<OutputType>("/_api/admin/push", { method: "POST", body });