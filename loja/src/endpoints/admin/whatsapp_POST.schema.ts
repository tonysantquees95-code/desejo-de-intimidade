import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 15, {
      message: "Informe o número com DDD, por exemplo 5511999998888.",
    }),
});

export type InputType = z.input<typeof schema>;
export type OutputType = { whatsappNumber: string };

export const postWhatsapp = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/whatsapp`, {
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