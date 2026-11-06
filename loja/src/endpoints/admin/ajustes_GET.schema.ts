import { apiRequest } from "../../helpers/apiRequest";

export type AjusteDTO = { id: number; quando: Date; area: string; texto: string; origem: string; ok: boolean };
export type OutputType = { ajustes: AjusteDTO[]; resumoHoje: string };

export const getAdminAjustes = () => apiRequest<OutputType>("/_api/admin/ajustes", { method: "GET" });