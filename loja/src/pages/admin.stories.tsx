import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, Copy, Instagram, MessageCircle } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { toast } from "../helpers/toast";
import { disablePush, enablePush, onPushEnabledChange } from "../helpers/pushClient";
import { getAdminStories, type StoryDTO } from "../endpoints/admin/stories_GET.schema";
import { postAdminStoriesMarcar } from "../endpoints/admin/stories_marcar_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.stories.module.css";

const fuso = { timeZone: "America/Sao_Paulo" } as const;
const hora = (d: Date | null) => (d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...fuso }) : "");
const dia = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", ...fuso });

/** Abre a tela de compartilhar do celular com a imagem (Instagram → Story, WhatsApp → Meu status). */
async function compartilhar(s: StoryDTO): Promise<boolean> {
  try {
    const resposta = await fetch(s.imagemUrl);
    const arquivo = new File([await resposta.blob()], `story-${s.id}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo] });
      return true;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return false; // fechou a tela de compartilhar
  }
  // sem compartilhar com arquivo (computador): abre a imagem para salvar
  window.open(s.imagemUrl, "_blank", "noopener");
  toast("Salve a imagem e publique pelo app.");
  return false;
}

function copiar(texto: string) {
  navigator.clipboard
    .writeText(texto)
    .then(() => toast("Pergunta copiada"))
    .catch(() => toast.error("Não consegui copiar. Segure o texto para copiar."));
}

/**
 * Stories do dia: a Vênus (app no celular do Toni) monta e manda para cá. Quem vir primeiro posta e marca;
 * o outro vê que já foi. Os avisos chegam nos celulares que ligarem "Receber avisos".
 */
export default function AdminStoriesPage() {
  const queryClient = useQueryClient();
  const [avisos, setAvisos] = useState(false);
  const [ligando, setLigando] = useState(false);
  useEffect(() => onPushEnabledChange(setAvisos), []);
  useEffect(() => {
    try {
      setAvisos(localStorage.getItem("floot-push-opt-in") === "1");
    } catch {
      setAvisos(false);
    }
  }, []);

  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "stories"], queryFn: () => getAdminStories() });
  const marcar = useMutation({
    mutationFn: postAdminStoriesMarcar,
    onSuccess: (r) => {
      toast(r.jaEstava ? `${r.por} já tinha publicado` : "Marcado como publicado");
      queryClient.invalidateQueries({ queryKey: ["admin", "stories"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const alternarAvisos = async () => {
    setLigando(true);
    try {
      if (avisos) await disablePush();
      else await enablePush();
      queryClient.invalidateQueries({ queryKey: ["admin", "stories"] });
    } catch {
      toast.error("Não consegui mudar os avisos neste celular.");
    } finally {
      setLigando(false);
    }
  };

  const postar = async (s: StoryDTO, onde: "instagram" | "whatsapp") => {
    if (onde === "instagram" && s.pergunta) {
      try {
        await navigator.clipboard.writeText(s.pergunta);
      } catch {
        // segue sem copiar
      }
    }
    await compartilhar(s);
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Stories | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Stories do dia" current="/admin/stories" />
      <main className={styles.main}>
        <div className={local.avisos}>
          <p className={local.avisosTexto}>
            {avisos ? <strong>Avisos ligados neste celular.</strong> : <strong>Ligue os avisos neste celular</strong>} Quando o story da tarde
            ficar pronto, chega uma notificação (no iPhone, abra pela Vênus da Loja instalada na tela de início).
            {data?.avisosLigados.length ? ` Recebem hoje: ${data.avisosLigados.join(", ")}.` : ""}
          </p>
          <Button variant={avisos ? "outline" : "primary"} size="sm" onClick={alternarAvisos} disabled={ligando}>
            {avisos ? <BellOff size={16} /> : <Bell size={16} />} {avisos ? "Desligar avisos" : "Receber avisos"}
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className={local.skeleton} />
        ) : isError || !data ? (
          <p className={styles.error}>Não foi possível carregar os stories.</p>
        ) : data.stories.length === 0 ? (
          <p className={styles.empty}>
            Nenhum story ainda. A Vênus do celular do Toni manda para cá o story da manhã (já publicado) e o da tarde (com enquete).
          </p>
        ) : (
          <div className={local.lista}>
            {data.stories.map((s) => {
              const pendente = s.enquete && !s.instagramPor;
              return (
                <article key={s.id} className={`${local.cartao} ${pendente ? local.cartaoPendente : ""}`}>
                  <img className={local.imagem} src={s.imagemUrl} alt={`Story: ${s.titulo}`} loading="lazy" />
                  <div className={local.corpo}>
                    <div className={local.topo}>
                      <span>
                        {dia(s.criado)} · {s.turno === "manha" ? "manhã" : "tarde"}
                      </span>
                      {pendente ? <Badge>Falta postar</Badge> : <Badge variant="secondary">No Instagram</Badge>}
                    </div>
                    <h2 className={local.titulo}>{s.titulo}</h2>
                    {s.enquete && s.pergunta ? (
                      <div className={local.pergunta}>
                        <span>Enquete: {s.pergunta}</span>
                        <Button variant="ghost" size="icon-sm" aria-label="Copiar a pergunta" onClick={() => copiar(s.pergunta ?? "")}>
                          <Copy size={16} />
                        </Button>
                      </div>
                    ) : null}
                    <div className={local.botoes}>
                      {pendente ? (
                        <>
                          <Button onClick={() => postar(s, "instagram")}>
                            <Instagram size={16} /> Postar no Instagram
                          </Button>
                          <Button variant="outline" disabled={marcar.isPending} onClick={() => marcar.mutate({ id: s.id, onde: "instagram" })}>
                            <Check size={16} /> Já publiquei no Instagram
                          </Button>
                        </>
                      ) : (
                        <p className={local.feito}>
                          Instagram: <strong>{s.instagramPor}</strong> às {hora(s.instagramEm)}
                        </p>
                      )}
                      {s.whatsappPor ? (
                        <p className={local.feito}>
                          Status do WhatsApp: <strong>{s.whatsappPor}</strong> às {hora(s.whatsappEm)}
                        </p>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => postar(s, "whatsapp")}>
                            <MessageCircle size={16} /> Status do WhatsApp
                          </Button>
                          <Button variant="ghost" size="sm" disabled={marcar.isPending} onClick={() => marcar.mutate({ id: s.id, onde: "whatsapp" })}>
                            <Check size={16} /> Já pus no status
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}