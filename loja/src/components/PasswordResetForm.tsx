import React, { useState } from "react";
import { z } from "zod";
import { MessageCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import styles from "./PasswordResetForm.module.css";
import {
  schema as requestSchema,
  postRequestPasswordReset,
} from "../endpoints/auth/request_password_reset_POST.schema";
import { postResetPassword } from "../endpoints/auth/reset_password_POST.schema";
import { useCatalog } from "../helpers/useCatalog";

const codeSchema = z.object({
  code: z.string().trim().min(1, "Digite o código que a loja enviou"),
  newPassword: z.string().min(8, "Use pelo menos 8 caracteres"),
  confirmPassword: z.string().min(1, "Repita a nova senha"),
});

interface PasswordResetFormProps {
  className?: string;
  defaultEmail?: string;
  /** Called after the password was changed (e.g. go back to the login form). */
  onDone: () => void;
  onCancel: () => void;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  className,
  defaultEmail = "",
  onDone,
  onCancel,
}) => {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [via, setVia] = useState<"whatsapp" | "email">("whatsapp");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: catalog } = useCatalog();
  const storeWhatsapp = catalog?.whatsappNumber ?? "";

  const emailForm = useForm({
    defaultValues: { email: defaultEmail },
    schema: requestSchema,
  });
  const codeForm = useForm({
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
    schema: codeSchema,
  });

  const whatsappUrl = (email: string) =>
    `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(
      `Olá! Esqueci a senha da minha conta no site da Desejo de Intimidade e preciso de um código para criar uma nova senha.\n\nE-mail da conta: ${email}`,
    )}`;

  /** Customer asks the store for a code on WhatsApp; the owner generates it in the admin. */
  const askStore = (email: string) => {
    setError(null);
    setVia("whatsapp");
    setSentTo(email);
    window.open(whatsappUrl(email), "_blank", "noopener,noreferrer");
  };

  const sendEmailCode = async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await postRequestPasswordReset({ email });
      setVia("email");
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: z.infer<typeof codeSchema>) => {
    if (!sentTo) return;
    if (data.newPassword !== data.confirmPassword) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await postResetPassword({
        email: sentTo,
        code: data.code,
        newPassword: data.newPassword,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha");
    } finally {
      setIsLoading(false);
    }
  };

  if (!sentTo) {
    return (
      <Form {...emailForm}>
        <form
          onSubmit={emailForm.handleSubmit((data) => askStore(data.email))}
          className={`${styles.form} ${className || ""}`}
        >
          <p className={styles.intro}>
            Digite o e-mail da sua conta. A loja confere e envia um código pelo
            WhatsApp para você criar uma nova senha.
          </p>
          {error && <div className={styles.errorMessage}>{error}</div>}
          <FormItem name="email">
            <FormLabel>E-mail</FormLabel>
            <FormControl>
              <Input
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                disabled={isLoading}
                value={emailForm.values.email}
                onChange={(e) =>
                  emailForm.setValues((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <Button
            type="submit"
            disabled={isLoading || !storeWhatsapp}
            className={styles.submitButton}
          >
            <MessageCircle size={16} /> Pedir código pelo WhatsApp da loja
          </Button>
          <button
            type="button"
            className={styles.linkButton}
            disabled={isLoading}
            onClick={() => {
              const parsed = requestSchema.safeParse({ email: emailForm.values.email });
              if (!parsed.success) {
                setError("Digite um e-mail válido.");
                return;
              }
              void sendEmailCode(parsed.data.email);
            }}
          >
            {isLoading ? "Enviando..." : "Receber o código por e-mail (só funciona para a conta da loja)"}
          </button>
          <button type="button" className={styles.linkButton} onClick={onCancel}>
            Voltar para entrar
          </button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...codeForm}>
      <form
        onSubmit={codeForm.handleSubmit(resetPassword)}
        className={`${styles.form} ${className || ""}`}
      >
        <p className={styles.intro}>
          {via === "whatsapp"
            ? `Pedimos o código para a loja pelo WhatsApp (conta ${sentTo}). Assim que ela responder com o código, digite aqui. O código vale por 30 minutos.`
            : `Se existir uma conta para ${sentTo}, um código está a caminho por e-mail. Ele vale por 15 minutos.`}
        </p>
        {error && <div className={styles.errorMessage}>{error}</div>}
        <FormItem name="code">
          <FormLabel>Código</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="12345678"
              disabled={isLoading}
              value={codeForm.values.code}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, code: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="newPassword">
          <FormLabel>Nova senha</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.newPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({ ...prev, newPassword: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="confirmPassword">
          <FormLabel>Repita a nova senha</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="new-password"
              disabled={isLoading}
              value={codeForm.values.confirmPassword}
              onChange={(e) =>
                codeForm.setValues((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <Button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? "Salvando..." : "Salvar nova senha"}
        </Button>
        {via === "whatsapp" && storeWhatsapp ? (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => window.open(whatsappUrl(sentTo), "_blank", "noopener,noreferrer")}
          >
            Abrir o WhatsApp da loja de novo
          </button>
        ) : null}
        <button type="button" className={styles.linkButton} onClick={onCancel}>
          Voltar para entrar
        </button>
      </form>
    </Form>
  );
};