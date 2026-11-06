import { z } from "zod";
import superjson from "superjson";

/** Pedido livre da administradora para a Vênus da loja com IA ("monta uma promoção de Natal com os géis parados"). */
export const schema = z.object({
  pedido: z.string().trim().min(2).max(800),
  /** Últimas trocas da conversa, para entender "e desse?", "pode fazer". */
  conversa: z.array(z.object({ de: z.enum(["eu", "venus"]), texto: z.string().max(1500) })).max(8).optional(),
});

export type InputType = z.infer<typeof schema>;

export type VenusIAAcao = {
  tipo: "preco" | "promocao" | "fim_promocao" | "estoque" | "custo" | "ativar" | "desativar";
  produtoId: number;
  /** Centavos (preço, promoção, custo) ou quantidade final (estoque). */
  valor: number | null;
  motivo: string;
};

export type OutputType = { texto: string; acoes: VenusIAAcao[]; disponivel: boolean };

export const postAdminVenusIA = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/venus_ia`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
