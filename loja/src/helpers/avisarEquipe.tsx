import { sendPushNotifications } from "@floot/push";
import { db } from "./db";

/**
 * Manda uma notificação para todos os celulares da equipe que ligaram os avisos no painel
 * (Toni, Natália...). Apaga as inscrições que não valem mais. Devolve quantos receberam.
 */
export async function avisarEquipe(aviso: { titulo: string; texto: string; url?: string; tag?: string }): Promise<number> {
  const inscricoes = await db.selectFrom("pushInscricoes").select(["id", "assinatura"]).execute();
  if (inscricoes.length === 0) return 0;
  const resultados = await sendPushNotifications(
    inscricoes.map((i) => i.assinatura as never),
    { title: aviso.titulo, body: aviso.texto, url: aviso.url ?? "/admin/stories", tag: aviso.tag, urgency: "high", ttl: 4 * 3600 },
  );
  const mortas = inscricoes.filter((_, i) => resultados[i]?.gone).map((i) => i.id);
  if (mortas.length > 0) await db.deleteFrom("pushInscricoes").where("id", "in", mortas).execute();
  return resultados.filter((r) => r.success).length;
}