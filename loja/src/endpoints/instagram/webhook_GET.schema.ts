import { z } from "zod";

/** A Meta confere o webhook com hub.mode, hub.verify_token e hub.challenge na URL. */
export const schema = z.object({});
export type OutputType = string;