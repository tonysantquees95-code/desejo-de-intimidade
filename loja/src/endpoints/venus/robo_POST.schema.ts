import { z } from "zod";

/**
 * O que o app Vênus Robô (ou o AutoResponder, no modo "Web Server") manda a cada mensagem nova no WhatsApp
 * ou no Instagram. A resposta é {"replies":[{"message":"...","delay":3,"delayMax":8}], "humano": false}.
 */
export const schema = z.object({
  appPackageName: z.string().optional(),
  messengerPackageName: z.string().optional(),
  query: z.object({
    sender: z.string().max(200),
    message: z.string().max(4000),
    isGroup: z.boolean().optional(),
    groupParticipant: z.string().optional(),
    ruleId: z.union([z.number(), z.string()]).optional(),
    isTestMessage: z.boolean().optional(),
  }),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { replies: { message: string; delay?: number; delayMax?: number }[]; humano?: boolean };