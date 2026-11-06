import { apiRequest } from "../../helpers/apiRequest";

export type ConversaDTO = {
  id: number;
  mensagens: { de: "cliente" | "venus"; texto: string; quando: number }[];
  pausada: boolean;
  atendimentos: number;
  atualizado: Date;
};
export type OutputType = {
  conectado: boolean;
  usuario: string;
  ligado: boolean;
  segredoConfigurado: boolean;
  /** A Meta confirmou a chave secreta (null = não deu para conferir). */
  segredoConfere: boolean | null;
  webhookUrl: string;
  tokenVerificacao: string;
  perguntas: { question: string; payload: string }[];
  conversas: ConversaDTO[];
};

export const getAdminInstagram = () => apiRequest<OutputType>("/_api/admin/instagram", { method: "GET" });