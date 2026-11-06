import { z } from "zod";
import superjson from "superjson";

/** Atendente virtual da loja (a "irmã da Vênus"): o cliente escreve, ela responde. */
export const schema = z.object({
  mensagem: z.string().trim().min(1).max(500),
});

export type InputType = z.infer<typeof schema>;

export type VenusProduto = {
  id: number;
  nome: string;
  precoCents: number | null;
  pixCents: number | null;
  imagem: string | null;
  esgotado: boolean;
};

export type VenusAcao = {
  rotulo: string;
  /** Endereço interno ("/produto/3") ou externo (WhatsApp). */
  url: string;
};

export type OutputType = {
  texto: string;
  produtos: VenusProduto[];
  acoes: VenusAcao[];
};

export const postVenusChat = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/venus/chat`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
