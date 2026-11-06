import { z } from "zod";

export const addressSchema = z.object({
  cep: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, { message: "CEP inválido" }),
  street: z.string().trim().min(1, "Informe a rua").max(120),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(80),
  neighborhood: z.string().trim().min(1, "Informe o bairro").max(80),
  city: z.string().trim().min(1, "Informe a cidade").max(80),
  state: z
    .string()
    .trim()
    .length(2, "Use a sigla do estado, ex.: SP")
    .transform((v) => v.toUpperCase()),
});

export type Address = z.infer<typeof addressSchema>;
export type AddressInput = z.input<typeof addressSchema>;
