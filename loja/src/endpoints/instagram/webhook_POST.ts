import { assinaturaValida, tratarEvento } from "../../helpers/instagramDirect";
import { schema } from "./webhook_POST.schema";

/** Mensagens do Direct do Instagram (Meta). Só aceita com a assinatura do app; responde 200 sempre que a assinatura vale. */
export async function handle(request: Request) {
  const corpo = await request.text();
  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"))) {
    console.warn("instagram webhook: assinatura inválida (confira a INSTAGRAM_APP_SECRET)");
    return new Response(JSON.stringify({ error: "assinatura inválida" }), { status: 401 });
  }
  try {
    const dados = schema.parse(JSON.parse(corpo));
    console.log(`instagram webhook: assinatura ok, ${dados.entry.length} entrada(s) de ${dados.object ?? "?"}`);
    if (dados.object === "instagram") {
      for (const entrada of dados.entry) {
        for (const evento of entrada.messaging ?? []) await tratarEvento(evento as never, entrada.id ?? "");
      }
    }
  } catch (error) {
    console.error("instagram webhook", error);
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}