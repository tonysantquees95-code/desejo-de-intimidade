import { apiRequest } from "../../helpers/apiRequest";

export type StoryDTO = {
  id: number;
  turno: string;
  titulo: string;
  texto: string;
  pergunta: string | null;
  imagemUrl: string;
  enquete: boolean;
  instagramPor: string | null;
  instagramEm: Date | null;
  whatsappPor: string | null;
  whatsappEm: Date | null;
  criado: Date;
};
export type OutputType = { stories: StoryDTO[]; avisosLigados: string[] };

export const getAdminStories = () => apiRequest<OutputType>("/_api/admin/stories", { method: "GET" });