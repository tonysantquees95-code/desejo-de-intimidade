import { importPKCS8, SignJWT } from "jose";
import { db } from "./db";

/**
 * Envio de notificações para o app Android da loja (Firebase Cloud Messaging, API v1).
 * A chave da conta de serviço do Firebase fica no segredo FIREBASE_CONTA_SERVICO (o JSON inteiro).
 * Os celulares ficam na tabela app_dispositivos, registrados pelo próprio app (endpoints/app/push_token).
 */

type ContaServico = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export type Aviso = { titulo: string; texto: string; url?: string };
export type ResultadoEnvio = { enviados: number; falhas: number; removidos: number };

let acessoEmCache: { token: string; expira: number } | null = null;

function lerConta(): ContaServico | null {
  const bruto = process.env.FIREBASE_CONTA_SERVICO;
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<ContaServico>;
    if (!c.project_id || !c.client_email || !c.private_key) return null;
    return {
      project_id: c.project_id,
      client_email: c.client_email,
      private_key: c.private_key.replace(/\\n/g, "\n"),
      token_uri: c.token_uri,
    };
  } catch {
    return null;
  }
}

export function firebaseConfigurado(): boolean {
  return lerConta() !== null;
}

async function tokenDeAcesso(conta: ContaServico): Promise<string> {
  if (acessoEmCache && acessoEmCache.expira > Date.now() + 60_000) return acessoEmCache.token;
  const chave = await importPKCS8(conta.private_key, "RS256");
  const agora = Math.floor(Date.now() / 1000);
  const audiencia = conta.token_uri ?? "https://oauth2.googleapis.com/token";
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(conta.client_email)
    .setSubject(conta.client_email)
    .setAudience(audiencia)
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chave);
  const resposta = await fetch(audiencia, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const dados = (await resposta.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!resposta.ok || !dados.access_token) {
    throw new Error(`O Firebase recusou a chave (${dados.error_description ?? dados.error ?? resposta.status}).`);
  }
  acessoEmCache = { token: dados.access_token, expira: Date.now() + (dados.expires_in ?? 3600) * 1000 };
  return acessoEmCache.token;
}

/**
 * Envia um aviso para os celulares informados. Celulares que desinstalaram o app ou
 * desativaram os avisos são removidos da tabela automaticamente.
 */
export async function enviarAviso(tokens: string[], aviso: Aviso): Promise<ResultadoEnvio> {
  const conta = lerConta();
  if (!conta) throw new Error("A chave do Firebase ainda não foi configurada.");
  const unicos = [...new Set(tokens.filter(Boolean))];
  const resultado: ResultadoEnvio = { enviados: 0, falhas: 0, removidos: 0 };
  if (unicos.length === 0) return resultado;

  const acesso = await tokenDeAcesso(conta);
  const destino = `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`;
  const invalidos: string[] = [];
  const LOTE = 20;

  for (let i = 0; i < unicos.length; i += LOTE) {
    await Promise.all(
      unicos.slice(i, i + LOTE).map(async (token) => {
        try {
          const r = await fetch(destino, {
            method: "POST",
            headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: aviso.titulo, body: aviso.texto },
                data: { url: aviso.url ?? "/" },
                android: {
                  priority: "high",
                  notification: {
                    channel_id: "loja",
                    icon: "ic_notificacao",
                    color: "#FF2E97",
                    visibility: "PRIVATE", // tela bloqueada: esconde o texto
                  },
                },
              },
            }),
          });
          if (r.ok) {
            resultado.enviados++;
            return;
          }
          resultado.falhas++;
          const corpo = await r.text();
          if (r.status === 404 || /UNREGISTERED|not a valid FCM registration token/i.test(corpo)) {
            invalidos.push(token);
          } else {
            console.error("Firebase: falha ao enviar aviso", r.status, corpo.slice(0, 300));
          }
        } catch (erro) {
          resultado.falhas++;
          console.error("Firebase: erro ao enviar aviso", erro);
        }
      }),
    );
  }

  if (invalidos.length > 0) {
    await db.deleteFrom("appDispositivos").where("token", "in", invalidos).execute();
    resultado.removidos = invalidos.length;
  }
  return resultado;
}

/** Avisa o cliente (nos celulares com o app) que o pedido saiu para entrega. Nunca lança erro. */
export async function avisarPedidoEnviado(pedidoId: number): Promise<void> {
  if (!firebaseConfigurado()) return;
  try {
    const pedido = await db
      .selectFrom("orders")
      .select("userId")
      .where("id", "=", pedidoId)
      .executeTakeFirst();
    if (!pedido) return;
    const aparelhos = await db
      .selectFrom("appDispositivos")
      .select("token")
      .where("usuarioId", "=", pedido.userId)
      .execute();
    if (aparelhos.length === 0) return;
    await enviarAviso(
      aparelhos.map((a) => a.token),
      {
        titulo: "Seu pedido foi enviado 📦",
        texto: `O pedido #${pedidoId} está a caminho. Toque para acompanhar.`,
        url: `/pedido/${pedidoId}`,
      },
    );
  } catch (erro) {
    console.error("aviso de pedido enviado", pedidoId, erro);
  }
}
