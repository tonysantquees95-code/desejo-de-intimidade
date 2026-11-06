import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({ userId: z.number().int().positive() });

export type InputType = z.infer<typeof schema>;
export type OutputType = {
  code: string;
  expiresInMinutes: number;
  email: string;
  displayName: string;
  phone: string | null;
};

export const postResetCode = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/reset_code", {
    method: "POST",
    body: schema.parse(body),
  });