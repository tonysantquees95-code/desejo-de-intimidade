import { apiRequest } from "../../helpers/apiRequest";

export type OutputType = {
  /** Celulares com o app que aceitaram avisos. */
  aparelhos: number;
  /** Desses, quantos estão ligados a uma conta de cliente. */
  comConta: number;
  /** Celulares da própria conta de quem está no painel (para o envio de teste). */
  meus: number;
  /** A chave do Firebase já foi cadastrada? */
  firebasePronto: boolean;
};

export const getAdminAvisos = () => apiRequest<OutputType>("/_api/admin/avisos", { method: "GET" });
