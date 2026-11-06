/**
 * Substituto do @floot/email. Sem um serviço de e-mail configurado, só registra no log e devolve erro,
 * e o código da loja segue o caminho de "não consegui mandar o e-mail" que ele já tem.
 * Para ligar: criar conta grátis no Resend, guardar RESEND_API_KEY como segredo do Worker.
 */
type Email = { from: string; to: string | string[]; subject: string; text?: string; html?: string; replyTo?: string };

export async function sendEmail(e: Email): Promise<{ ok: true; id?: string } | { ok: false; error: { code: string; message: string } }> {
  const chave = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.RESEND_API_KEY;
  if (!chave) {
    console.warn("email não enviado (sem RESEND_API_KEY):", e.subject);
    return { ok: false, error: { code: "not_configured", message: "E-mail ainda não configurado no servidor." } };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: e.from, to: e.to, subject: e.subject, text: e.text, html: e.html, reply_to: e.replyTo }),
  });
  if (!r.ok) return { ok: false, error: { code: "send_failed", message: `Resend HTTP ${r.status}` } };
  const j = (await r.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: j.id };
}
