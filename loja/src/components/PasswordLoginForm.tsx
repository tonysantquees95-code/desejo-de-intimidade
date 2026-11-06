import React, { useState } from "react";
import { z } from "zod";
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
import { PasswordResetForm } from "./PasswordResetForm";
import styles from "./PasswordLoginForm.module.css";
import {
  schema,
  postLogin,
} from "../endpoints/auth/login_with_password_POST.schema";
import { useAuth } from "../helpers/useAuth";

export type LoginFormData = z.infer<typeof schema>;

interface PasswordLoginFormProps {
  className?: string;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const { onLogin } = useAuth();

  const form = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    schema,
  });

  const handleSubmit = async (data: LoginFormData) => {
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const result = await postLogin(data);
      onLogin(result.user);
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Não foi possível entrar. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Keep "Forgot password?" reachable: it is the only way back in for an
  // account without a working password (it works even when sign-up is closed).
  if (resetting) {
    return (
      <PasswordResetForm
        className={className}
        defaultEmail={form.values.identifier.includes("@") ? form.values.identifier : ""}
        onCancel={() => setResetting(false)}
        onDone={() => {
          setResetting(false);
          setError(null);
          setNotice("Senha atualizada. Entre com a nova senha.");
        }}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {notice && <div className={styles.noticeMessage}>{notice}</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="identifier">
          <FormLabel>E-mail, CPF ou telefone</FormLabel>
          <FormControl>
            <Input
              placeholder="seu@email.com, CPF ou celular"
              autoComplete="username"
              autoCapitalize="none"
              disabled={isLoading}
              value={form.values.identifier}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, identifier: e.target.value }))
              }
            />
          </FormControl>
          <FormDescription>
            Use o e-mail, o CPF ou o celular cadastrado. CPF e celular valem para
            quem já comprou ou se cadastrou com eles.
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Senha</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              value={form.values.password}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <button
          type="button"
          className={styles.forgotButton}
          onClick={() => setResetting(true)}
        >
          Esqueci minha senha
        </button>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <span className={styles.loadingText}>
              <Spinner className={styles.spinner} size="sm" />
              Entrando...
            </span>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </Form>
  );
};
