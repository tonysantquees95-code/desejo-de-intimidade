import { z } from "zod";
import superjson from "superjson";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ ligado: z.boolean() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { ligado: boolean };

export const postAdminRoboLigar = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/robo_ligar", { method: "POST", body: schema.parse(body) });