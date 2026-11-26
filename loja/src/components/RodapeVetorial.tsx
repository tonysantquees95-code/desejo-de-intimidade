import { useLocation } from "react-router-dom";
import styles from "./RodapeVetorial.module.css";

/** Texto que explica quem processa o pagamento: usado no rodapé e na hora de pagar, para ninguém estranhar o nome. */
export const AVISO_PAGAMENTO =
  "O pagamento é feito na página segura da InfinitePay, e o dinheiro vai direto para a Desejo de Intimidade. " +
  "Os dados do cartão não passam pelo nosso servidor. A compra é da Desejo de Intimidade, com entrega discreta.";

export const AvisoPagamento = ({ className }: { className?: string }) => (
  <p className={`${styles.aviso} ${className ?? ""}`} role="note">
    <strong>Pagamento seguro pela InfinitePay.</strong> {AVISO_PAGAMENTO}
  </p>
);

/** Rodapé de todas as páginas da loja (menos o painel do administrador). */
export const RodapeVetorial = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return (
    <footer className={styles.rodape}>
      <span>Site feito pela <strong>Vetorial Tech</strong></span>
      <span className={styles.nota}>Pagamentos processados com segurança pela InfinitePay.</span>
    </footer>
  );
};
