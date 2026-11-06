import { sendEmail } from "@floot/email";
import { db } from "./db";

export type StockAlert = { name: string; remaining: number };

const FROM = "Desejo de Intimidade <noreply@example.com>";

/** E-mails the store administrators about products that ran out or got low. */
export async function notifyStockAlerts(alerts: StockAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const admins = await db
    .selectFrom("users")
    .select("email")
    .where("role", "=", "admin")
    .execute();
  if (admins.length === 0) return;

  const out = alerts.filter((a) => a.remaining <= 0);
  const low = alerts.filter((a) => a.remaining > 0);
  const lines = [
    ...(out.length ? ["ESGOTADOS:", ...out.map((a) => `- ${a.name}`), ""] : []),
    ...(low.length
      ? ["ESTOQUE BAIXO:", ...low.map((a) => `- ${a.name} (restam ${a.remaining})`), ""]
      : []),
    "Atualize o estoque em Painel > Estoque.",
  ];
  const subject = out.length
    ? `Produto esgotado: ${out[0].name}${alerts.length > 1 ? " e outros" : ""}`
    : `Estoque baixo: ${low[0].name}${alerts.length > 1 ? " e outros" : ""}`;
  const html = `<p>${lines
    .map((l) => (l ? l.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "<br>"))
    .join("<br>")}</p>`;

  for (const admin of admins) {
    try {
      const result = await sendEmail({
        from: FROM,
        to: admin.email,
        subject,
        text: lines.join("\n"),
        html,
      });
      console.log("aviso de estoque enviado", admin.email, JSON.stringify(result));
    } catch (error) {
      console.error("aviso de estoque não enviado", admin.email, error);
    }
  }
}