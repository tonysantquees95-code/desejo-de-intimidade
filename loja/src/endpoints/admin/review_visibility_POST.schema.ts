import { z } from "zod";
import { apiRequest } from "../../helpers/apiRequest";

export const schema = z.object({
  id: z.number().int().positive(),
  visible: z.boolean(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postReviewVisibility = (body: InputType) =>
  apiRequest<OutputType>("/_api/admin/review_visibility", {
    method: "POST",
    body: schema.parse(body),
  });