import React from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircleHeart, Power, Sparkles } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { toast } from "../helpers/toast";
import { getAdminInstagram } from "../endpoints/admin/instagram_GET.schema";
import { postAdminInstagramDirect } from "../endpoints/admin/instagram_direct_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.instagram.module.css";

const quando = (n: number | Date) =>
  new Date(n).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function copiar(texto: string, rotulo: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast(`${rotulo} copiado`),
    () => toast.error("Não consegui copiar. Segure o texto para copiar."),
  );
}

/** Direct automático do Instagram: liga e desliga, configuração da Meta e as últimas conversas. */
export default function AdminInstagramPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "instagram"], queryFn: () => getAdminInstagram() });
  const acao = useMutation({
    mutationFn: postAdminInstagramDirect,
    onSuccess: (r) => {
      if (r.ok) toast(r.mensagem);
      else toast.error(r.mensagem);
      queryClient.invalidateQueries({ queryKey: ["admin", "instagram"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Instagram | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Direct do Instagram" current="/admin/instagram" />
      <main className={styles.main}>
        {isLoading ? (
          <Skeleton className={local.skeleton} />
        ) : isError || !data ? (
          <p className={styles.error}>Não foi possível carregar o Direct do Instagram.</p>
        ) : (
          <>
            <section className={styles.card}>
              <div className={local.cabeca}>
                <h2 className={styles.cardTitle}>Resposta automática</h2>
                {data.ligado ? <Badge>Ligada</Badge> : <Badge variant="secondary">Desligada</Badge>}
              </div>
              <p className={styles.hint}>
                {data.conectado
                  ? `Instagram conectado${data.usuario ? ` (@${data.usuario.replace(/^@/, "")})` : ""} pela Vênus app.`
                  : "O Instagram ainda não foi conectado. Conecte pela Vênus app (Publicações → Conectar Instagram)."}{" "}
                Ligada, a Vênus dá boas-vindas com o link do site e as opções Tipos de frete, Formas de pagamento, Tipos de envio,
                Troca e devolução e Falar com a equipe. Responde as perguntas com as regras de venda e, quando alguém da loja
                responder pelo Instagram, fica 12 horas em silêncio com aquela cliente.
              </p>
              <div className={local.botoes}>
                <Button
                  variant={data.ligado ? "outline" : "primary"}
                  disabled={acao.isPending || (!data.ligado && (!data.conectado || !data.segredoConfigurado))}
                  onClick={() => acao.mutate({ acao: data.ligado ? "desligar" : "ligar" })}
                >
                  <Power size={16} /> {data.ligado ? "Desligar" : "Ligar resposta automática"}
                </Button>
                <Button variant="outline" disabled={acao.isPending || !data.conectado} onClick={() => acao.mutate({ acao: "perguntas" })}>
                  <Sparkles size={16} /> Aplicar perguntas frequentes
                </Button>
              </div>
              {!data.segredoConfigurado ? (
                <p className={local.aviso}>Falta a chave secreta do app da Meta (INSTAGRAM_APP_SECRET) para conferir as mensagens.</p>
              ) : data.segredoConfere === false ? (
                <p className={local.aviso}>A Meta não reconheceu a chave secreta guardada. Confira a “Chave Secreta do Aplicativo” (Configurações do app → Básico).</p>
              ) : data.segredoConfere ? (
                <p className={styles.hint}>Chave secreta conferida com a Meta ✓</p>
              ) : null}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Configuração na Meta</h2>
              <p className={styles.hint}>
                No app da Meta (developers.facebook.com → seu app → Instagram → Webhooks), cole estes dois valores e assine o campo
                “messages”.
              </p>
              <div className={local.campo}>
                <span className={local.rotulo}>URL de retorno</span>
                <code>{data.webhookUrl}</code>
                <Button variant="ghost" size="icon-sm" aria-label="Copiar a URL" onClick={() => copiar(data.webhookUrl, "Endereço")}>
                  <Copy size={16} />
                </Button>
              </div>
              <div className={local.campo}>
                <span className={local.rotulo}>Token de verificação</span>
                <code>{data.tokenVerificacao}</code>
                <Button variant="ghost" size="icon-sm" aria-label="Copiar o token" onClick={() => copiar(data.tokenVerificacao, "Token")}>
                  <Copy size={16} />
                </Button>
              </div>
              <p className={styles.hint}>Perguntas frequentes que aparecem para quem abre o Direct pela primeira vez:</p>
              <ul className={local.perguntas}>
                {data.perguntas.map((p) => (
                  <li key={p.payload}>{p.question}</li>
                ))}
              </ul>
            </section>

            <section className={local.conversas}>
              <h2 className={styles.cardTitle}>Últimas conversas</h2>
              {data.conversas.length === 0 ? (
                <p className={styles.empty}>Nenhuma conversa ainda.</p>
              ) : (
                data.conversas.map((c) => (
                  <article key={c.id} className={styles.card}>
                    <div className={local.cabeca}>
                      <span className={local.rotulo}>
                        <MessageCircleHeart size={14} /> {quando(c.atualizado)} · {c.atendimentos} mensagens
                      </span>
                      {c.pausada ? <Badge variant="secondary">Com a equipe</Badge> : null}
                    </div>
                    <div className={local.mensagens}>
                      {c.mensagens.slice(-6).map((m, i) => (
                        <p key={i} className={m.de === "cliente" ? local.cliente : local.venus}>
                          {m.texto}
                        </p>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}