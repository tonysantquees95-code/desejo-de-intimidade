import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { useAuth } from "../helpers/useAuth";
import styles from "./login.module.css";

export default function CadastroPage() {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  useEffect(() => {
    if (authState.type === "authenticated") {
      navigate(safeNext ?? "/", { replace: true });
    }
  }, [authState, navigate, safeNext]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Criar conta | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className={styles.card}>
        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.subtitle}>
          Cadastre-se para comprar com rapidez e acompanhar seus pedidos. Seus
          dados são usados só para a entrega e nunca compartilhados.
        </p>
        <PasswordRegisterForm />
        <p className={styles.subtitle}>
          Já tem conta?{" "}
          <Link
            to={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
            className={styles.inlineLink}
          >
            Entrar
          </Link>
        </p>
        <Link to="/" className={styles.back}>
          <ArrowLeft size={16} /> Voltar ao site
        </Link>
      </div>
    </div>
  );
}