import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ id: z.number().int(), onde: z.enum(["instagram", "whatsapp"]) });
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: boolean; por: string; jaEstava: boolean };

export const postAdminStoriesMarcar = (body: InputType) => apiRequest<OutputType>("/_api/admin/stories_marcar", { method: "POST", body });