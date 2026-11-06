import { apiRequest } from "../../helpers/apiRequest";

export type RoboEsperando = { canal: string; ultimaMensagem: string; quando: Date };
export type OutputType = {
  ligado: boolean;
  chave: string;
  endereco: string;
  hoje: { atendimentos: number; clientes: number; passadas: number };
  esperando: RoboEsperando[];
};

export const getAdminRobo = () => apiRequest<OutputType>("/_api/admin/robo", { method: "GET" });