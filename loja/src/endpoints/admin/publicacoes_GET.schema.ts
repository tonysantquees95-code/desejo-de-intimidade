import { apiRequest } from "../../helpers/apiRequest";
import type { StoryDTO } from "./stories_GET.schema";

export type IdeiaDTO = { ref: string; titulo: string; data: Date | null; formato: string; legenda: string };
export type PedidoDTO = {
  id: number;
  tipo: "story_outro" | "post" | "story";
  turno: string | null;
  ideiaTitulo: string | null;
  quando: Date | null;
  estado: "pendente" | "fazendo" | "feito" | "erro";
  resultado: string | null;
  imagemUrl: string | null;
  pedidoPor: string | null;
  criado: Date;
};
export type OutputType = {
  stories: StoryDTO[];
  ideias: IdeiaDTO[];
  pedidos: PedidoDTO[];
  /** Última vez que a Vênus do celular conferiu os pedidos (null se nunca). */
  appVistoEm: Date | null;
};

export const getAdminPublicacoes = () => apiRequest<OutputType>("/_api/admin/publicacoes", { method: "GET" });