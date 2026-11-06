import { z } from "zod";

export const schema = z.object({ id: z.number().int() });
export type InputType = z.infer<typeof schema>;
export type OutputType = { lembrou: boolean };