import React, { useState } from "react";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import styles from "./PasswordRegisterForm.module.css";
import { useAuth } from "../helpers/useAuth";
import {
  schema,
  postRegister,
} from "../endpoints/auth/register_with_password_POST.schema";

export type RegisterFormData = z.infer<typeof schema>;

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

interface PasswordRegisterFormProps {
  className?: string;
  defaultValues?: Partial<RegisterFormData>;
}

export const PasswordRegisterForm: React.FC<PasswordRegisterFormProps> = ({
  className,
  defaultValues,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onLogin } = useAuth();

  const form = useForm({
    schema,
    defaultValues: defaultValues || {
      email: "",
      password: "",
      displayName: "",
      cpf: "",
      phone: "",
    },
  });

  const handleSubmit = async (data: z.infer<typeof schema>) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postRegister(data);
      console.log("Registration successful for:", data.email);
      onLogin(result.user);
    } catch (err) {
      console.error("Registration error:", err);

      if (err instanceof Error) {
        const errorMessage = err.message;

        if (errorMessage.includes("Email already in use")) {
          setError("Este e-mail já está cadastrado. Tente entrar.");
        } else if (errorMessage.toLowerCase().includes("display name")) {
          setError("Please provide a valid display name that isn't empty.");
        } else if (
          errorMessage.includes("display") ||
          errorMessage.includes("name")
        ) {
          setError("Please check your display name: " + errorMessage);
        } else {
          setError(errorMessage || "Registration failed. Please try again.");
        }
      } else {
        console.log("Unknown error type:", err);
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form
        onSubmit={form.handleSubmit((data) =>
          handleSubmit(data as z.infer<typeof schema>)
        )}
        className={`${styles.form} ${className || ""}`}
      >
        <FormItem name="email">
          <FormLabel>E-mail</FormLabel>
          <FormControl>
            <Input
              placeholder="seu@email.com"
              value={form.values.email || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="displayName">
          <FormLabel>Nome</FormLabel>
          <FormControl>
            <Input
              id="register-display-name"
              placeholder="Seu nome"
              value={form.values.displayName || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormDescription>Como você quer ser chamada(o)</FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="cpf">
          <FormLabel>CPF</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={form.values.cpf || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({ ...prev, cpf: maskCpf(e.target.value) }))
              }
            />
          </FormControl>
          <FormDescription>Serve também para entrar e para as compras</FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="phone">
          <FormLabel>Celular (WhatsApp)</FormLabel>
          <FormControl>
            <Input
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={form.values.phone || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({ ...prev, phone: maskPhone(e.target.value) }))
              }
            />
          </FormControl>
          <FormDescription>Usado para avisos do pedido e para entrar</FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Senha</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.values.password || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormDescription>
            Mínimo de 8 caracteres, com letra maiúscula, minúscula e número
          </FormDescription>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" /> Criando conta...
            </>
          ) : (
            "Criar conta"
          )}
        </Button>
      </form>
    </Form>
  );
};
