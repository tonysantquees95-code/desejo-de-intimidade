import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({
  titulo: z.string().trim().min(1, "Escreva o título.").max(65, "Título com até 65 letras."),
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(180, "Mensagem com até 180 letras."),
  /** Página da loja que abre ao tocar no aviso (sempre do próprio site, começando com /). */
  url: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/(?!\/)/, "O link precisa ser uma página da loja, começando com /."),
  /** "teste": só para os celulares de quem está no painel. "todos": para todos os celulares. */
  destino: z.enum(["teste", "todos"]),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { enviados: number; falhas: number; removidos: number; total: number };

export const postAvisoEnviar = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/aviso_enviar", { method: "POST", body: schema.parse(body) });
