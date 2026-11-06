import { z } from "zod";
import { User } from "../../helpers/User";
import superjson from "superjson";
import { isValidCpf } from "../../helpers/isValidCpf";

// Typos that would create an account nobody can ever receive e-mail on.
const MISTYPED_DOMAINS = new Set([
  "gmail.col", "gmail.co", "gmail.cm", "gmail.con", "gmai.com", "gmial.com",
  "gamil.com", "gmail.om", "gnail.com", "hotmai.com", "hotmail.con",
  "hotmial.com", "outlook.con", "outlok.com", "yaho.com", "yahoo.con",
  "yahho.com", "icloud.con", "uol.com", "bol.com",
]);

export const schema = z.object({
  email: z
    .string()
    .email("Informe um e-mail válido")
    .refine((v) => !MISTYPED_DOMAINS.has(v.split("@")[1]?.toLowerCase() ?? ""), {
      message: "Confira o e-mail: o final parece ter um erro de digitação (ex.: gmail.com).",
    }),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
  displayName: z.string().min(1, "Informe seu nome"),
  cpf: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      message: "Informe o celular com DDD",
    }),
});

export type OutputType = {
  user: User;
};

export const postRegister = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
  }
  const validatedInput = parsed.data;
  const result = await fetch(`/_api/auth/register_with_password`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include", // Important for cookies to be sent and received
  });

  if (!result.ok) {
    const errorData = superjson.parse<{ message: string }>(await result.text());
    throw new Error(errorData.message || "Registration failed");
  }

  return superjson.parse<OutputType>(await result.text());
};
