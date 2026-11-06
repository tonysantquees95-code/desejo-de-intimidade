import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";
import { PREFERENCIAS_TROCA_IDS, TIPOS_TROCA_IDS } from "../../helpers/trocas";

export const schema = z.object({
  orderId: z.number().int().positive(),
  tipo: z.enum(TIPOS_TROCA_IDS),
  preferencia: z.enum(PREFERENCIAS_TROCA_IDS),
  itens: z.array(z.string().trim().min(1).max(200)).min(1, "Marque pelo menos um item.").max(30),
  descricao: z
    .string()
    .trim()
    .min(10, "Conte com um pouco mais de detalhe o que aconteceu.")
    .max(1000, "Texto muito longo (máximo 1000 caracteres)."),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { id: number; mensagem: string };

export const postTroca = (body: InputType) =>
  apiRequest<OutputType>("/_api/shop/troca", { method: "POST", body: schema.parse(body) });