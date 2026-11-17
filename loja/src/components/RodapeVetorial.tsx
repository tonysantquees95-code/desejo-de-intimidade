import { useLocation } from "react-router-dom";
import styles from "./RodapeVetorial.module.css";

/** Texto que explica quem processa o pagamento: usado no rodapé e na hora de pagar, para ninguém estranhar o nome. */
export const AVISO_PAGAMENTO =
  "O pagamento é processado pela Vetorial Tech, empresa que criou e mantém este site. " +
  "No Pix ou no cartão, o nome que aparece pode ser Vetorial Tech. A compra é da Desejo de Intimidade, com entrega discreta.";

export const AvisoPagamento = ({ className }: { className?: string }) => (
  <p className={`${styles.aviso} ${className ?? ""}`} role="note">
    <strong>Pagamento seguro pela Vetorial Tech.</strong> {AVISO_PAGAMENTO}
  </p>
);

/** Rodapé de todas as páginas da loja (menos o painel do administrador). */
export const RodapeVetorial = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return (
    <footer className={styles.rodape}>
      <span>Site feito pela <strong>Vetorial Tech</strong></span>
      <span className={styles.nota}>Os pagamentos desta loja são processados pela Vetorial Tech.</span>
    </footer>
  );
};
