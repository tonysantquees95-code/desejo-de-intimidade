import React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, ShoppingBag, User } from "lucide-react";
import { Helmet } from "react-helmet";
import { Button } from "./Button";
import { VenusChat } from "./VenusChat";
import { InstalarApp } from "./InstalarApp";
import { useAuth } from "../helpers/useAuth";
import { useCart } from "../helpers/cart";
import styles from "./SiteHeader.module.css";

const LOGO_URL =
  "/_cdn/static/5fca2697-82ee-406c-9472-4a112f72f1b7-C-pia-de-C-pia-de-Logotipo-Boutique_20261026_013613_0000.png";

export const SiteHeader = ({ whatsappUrl }: { whatsappUrl?: string }) => {
  const { authState } = useAuth();
  const { count } = useCart();
  const loggedIn = authState.type === "authenticated";

  return (
    <header className={styles.header}>
      {/* Deixa instalar o site como app (Android) e colocar na Tela de Início com ícone (iPhone) */}
      <Helmet>
        <link rel="manifest" href="/loja-app.json" />
        <link rel="apple-touch-icon" href={LOGO_URL} />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Desejo" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </Helmet>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="Desejo de Intimidade">
          <img className={styles.logoImage} src={LOGO_URL} alt="Logo Desejo de Intimidade" />
          {/* Nome em neon, no estilo do logo: letras contornadas com traço grosso e brilho */}
          <span className={styles.logoText}>
            <span>Desejo de</span>
            <span>Intimidade</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          <Link to="/#categorias">Categorias</Link>
          <Link to="/#discricao">Entrega discreta</Link>
          <Link to="/#depoimentos">Depoimentos</Link>
          <Link to="/#contato">Contato</Link>
        </nav>

        <div className={styles.actions}>
          <Link
            to={loggedIn ? "/minha-conta" : "/login"}
            className={styles.iconLink}
            aria-label={loggedIn ? "Minha conta" : "Entrar"}
          >
            <User size={20} />
            <span className={styles.iconLabel}>
              {loggedIn ? "Minha conta" : "Entrar"}
            </span>
          </Link>
          <Link to="/carrinho" className={styles.iconLink} aria-label="Carrinho">
            <ShoppingBag size={20} />
            {count > 0 ? <span className={styles.badge}>{count}</span> : null}
            <span className={styles.iconLabel}>Carrinho</span>
          </Link>
          {whatsappUrl ? (
            <Button asChild size="md" className={styles.cta}>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> <span className={styles.ctaLabel}>WhatsApp</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      {/* Aviso "tenha o app": só no celular, some quando já instalado ou se fechar */}
      <InstalarApp variante="faixa" />
      {/* Atendente virtual (orbe rosa no canto): em todas as páginas da loja, fora do painel. */}
      <VenusChat />
    </header>
  );
};
