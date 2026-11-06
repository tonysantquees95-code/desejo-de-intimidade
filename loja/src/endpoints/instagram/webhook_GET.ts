import { tokenDeVerificacao } from "../../helpers/instagramDirect";

/** Verificação do webhook pela Meta: devolve o hub.challenge se a senha (verify token) bater. */
export async function handle(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const senha = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge") ?? "";
  if (modo === "subscribe" && senha && senha === (await tokenDeVerificacao())) {
    return new Response(desafio, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}