import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { useAuth } from "../helpers/useAuth";
import styles from "./login.module.css";

export default function LoginPage() {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  // only allow in-site paths
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  useEffect(() => {
    if (authState.type === "authenticated") {
      navigate(
        safeNext ?? (authState.user.role === "admin" ? "/admin" : "/minha-conta"),
        { replace: true },
      );
    }
  }, [authState, navigate, safeNext]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Entrar | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className={styles.card}>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>
          Acesse sua conta para comprar e acompanhar seus pedidos.
        </p>
        <PasswordLoginForm />
        <p className={styles.subtitle}>
          Ainda não tem conta?{" "}
          <Link
            to={safeNext ? `/cadastro?next=${encodeURIComponent(safeNext)}` : "/cadastro"}
            className={styles.inlineLink}
          >
            Cadastre-se
          </Link>
        </p>
        <Link to="/" className={styles.back}>
          <ArrowLeft size={16} /> Voltar ao site
        </Link>
      </div>
    </div>
  );
}