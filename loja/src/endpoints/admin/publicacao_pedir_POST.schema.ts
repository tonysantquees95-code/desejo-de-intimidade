import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

/** Pedido da página Publicações para a Vênus do celular: outro story, ou programar uma ideia como post/story. */
export const schema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("story_outro"), turno: z.enum(["manha", "tarde"]) }),
  z.object({
    tipo: z.enum(["post", "story"]),
    ideiaRef: z.string().min(1).max(40),
    quando: z.coerce.date(),
    legenda: z.string().max(2200).optional(),
  }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { id: number };

export const postAdminPublicacaoPedir = (body: InputType) => apiRequest<OutputType>("/_api/admin/publicacao_pedir", { method: "POST", body });