import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";
import { ESTADOS_TROCA_IDS } from "../../helpers/trocas";

export const schema = z.object({
  id: z.number().int().positive(),
  estado: z.enum(ESTADOS_TROCA_IDS),
  resposta: z.string().trim().max(1000).nullable(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postAdminTroca = (body: InputType) => apiRequest<OutputType>("/_api/admin/troca", { method: "POST", body: schema.parse(body) });