import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./card_key_GET.schema";

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);
    const publicKey = process.env.MP_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("MP_PUBLIC_KEY não configurado.");
    }
    return new Response(superjson.stringify({ publicKey } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("card key error", error);
    return new Response(
      superjson.stringify({
        error: "Pagamento com cartão indisponível no momento. Use o Pix.",
      }),
      { status: 503 },
    );
  }
}