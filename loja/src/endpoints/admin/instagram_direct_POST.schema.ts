import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ acao: z.enum(["ligar", "desligar", "perguntas"]) });
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: boolean; mensagem: string };

export const postAdminInstagramDirect = (body: InputType) => apiRequest<OutputType>("/_api/admin/instagram_direct", { method: "POST", body });