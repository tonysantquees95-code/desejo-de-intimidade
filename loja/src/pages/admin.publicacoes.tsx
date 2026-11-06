import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, BellOff, Check, Copy, Instagram, MessageCircle, RefreshCw } from "lucide-react";
import { VenusOrbe } from "../components/VenusOrbe";
import { toast } from "../helpers/toast";
import { disablePush, enablePush, onPushEnabledChange } from "../helpers/pushClient";
import type { StoryDTO } from "../endpoints/admin/stories_GET.schema";
import { postAdminStoriesMarcar } from "../endpoints/admin/stories_marcar_POST.schema";
import { getAdminPublicacoes, type IdeiaDTO, type PedidoDTO } from "../endpoints/admin/publicacoes_GET.schema";
import { postAdminPublicacaoPedir } from "../endpoints/admin/publicacao_pedir_POST.schema";
import s from "./admin.publicacoes.module.css";

const fuso = { timeZone: "America/Sao_Paulo" } as const;
const hora = (d: Date | null) => (d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...fuso }) : "");
const diaHora = (d: Date) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", ...fuso });
const nomeTurno = (t: string | null) => (t === "manha" ? "manhã" : "tarde");

/** Abre o "compartilhar" do iPhone com a imagem (Instagram → Story, WhatsApp → Meu status). */
async function compartilhar(story: StoryDTO, pergunta: boolean) {
  if (pergunta && story.pergunta) {
    try {
      await navigator.clipboard.writeText(story.pergunta);
      toast("Pergunta da enquete copiada");
    } catch {
      // segue sem copiar
    }
  }
  try {
    const resposta = await fetch(story.imagemUrl);
    const arquivo = new File([await resposta.blob()], `story-${story.id}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo] });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  window.open(story.imagemUrl, "_blank", "noopener");
  toast("Salve a imagem e publique pelo app.");
}

/** Sugestão de horário da ideia: feed às 19h, story às 12h, no dia sugerido (ou amanhã). Formato do campo datetime-local. */
function sugestao(ideia: IdeiaDTO, tipo: "post" | "story"): string {
  const h = tipo === "story" ? 12 : 19;
  const agora = new Date();
  const base = ideia.data ? new Date(ideia.data) : null;
  let alvo = base ? new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h) : null;
  if (!alvo || alvo.getTime() < agora.getTime() + 10 * 60_000) {
    alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, h);
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${alvo.getFullYear()}-${p(alvo.getMonth() + 1)}-${p(alvo.getDate())}T${p(alvo.getHours())}:00`;
}

const ESTADO: Record<PedidoDTO["estado"], string> = { pendente: "Na fila", fazendo: "A Vênus está fazendo…", feito: "Pronto", erro: "Não deu certo" };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={s.secao}>{titulo}</h2>
      <div className={s.cartao}>{children}</div>
    </section>
  );
}

/** Uma ideia de post com Programar post / Programar story (dia, hora e legenda). */
function LinhaIdeia({ ideia, aoPedir, ocupado }: { ideia: IdeiaDTO; aoPedir: (tipo: "post" | "story", quando: string, legenda: string) => void; ocupado: boolean }) {
  const [tipo, setTipo] = useState<"post" | "story" | null>(null);
  const [quando, setQuando] = useState("");
  const [legenda, setLegenda] = useState(ideia.legenda);
  const abrir = (t: "post" | "story") => {
    setTipo(t);
    setQuando(sugestao(ideia, t));
  };
  const dia = ideia.data ? new Date(ideia.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }) : "quando quiser";
  return (
    <div className={s.linha}>
      <div className={s.textos}>
        <p className={s.tituloLinha}>{ideia.titulo}</p>
        <p className={s.descricao}>
          Sugerido: {dia} · {ideia.formato}
        </p>
        {ideia.legenda && !tipo ? <p className={`${s.descricao} ${s.legenda}`}>{ideia.legenda}</p> : null}
        {tipo ? (
          <div className={s.editor}>
            <label className={s.rotulo}>
              Quando sai
              <input className={s.campo} type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
            </label>
            <label className={s.rotulo}>
              {tipo === "story" ? "Texto (fica guardado)" : "Legenda"}
              <textarea className={s.campo} rows={4} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
            </label>
            <p className={s.descricao}>A Vênus monta a arte com a foto do produto e programa no celular do Toni.</p>
            <div className={s.acoes}>
              <button className={s.botao} disabled={ocupado || !quando} onClick={() => aoPedir(tipo, quando, legenda)}>
                Programar {tipo === "story" ? "story" : "post"}
              </button>
              <button className={s.botaoSecundario} onClick={() => setTipo(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={s.acoes}>
            <button className={ideia.formato === "story" ? s.botaoSecundario : s.botao} onClick={() => abrir("post")}>
              Programar post
            </button>
            <button className={ideia.formato === "story" ? s.botao : s.botaoSecundario} onClick={() => abrir("story")}>
              Programar story
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Publicações da Vênus no site, com a mesma cara da tela de ajustes do app: stories de hoje (prévia, enquete,
 * compartilhar no Instagram e no status do WhatsApp), ideias de post e pedidos para a Vênus do celular do Toni,
 * que confere a cada 2 minutos e responde aqui.
 */
export default function AdminPublicacoesPage() {
  const queryClient = useQueryClient();
  const [avisos, setAvisos] = useState(false);
  useEffect(() => onPushEnabledChange(setAvisos), []);
  useEffect(() => {
    try {
      setAvisos(localStorage.getItem("floot-push-opt-in") === "1");
    } catch {
      setAvisos(false);
    }
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "publicacoes"],
    queryFn: () => getAdminPublicacoes(),
    refetchInterval: (q) => (q.state.data?.pedidos.some((p) => p.estado === "pendente" || p.estado === "fazendo") ? 15_000 : 60_000),
  });
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["admin", "publicacoes"] });
  const marcar = useMutation({
    mutationFn: postAdminStoriesMarcar,
    onSuccess: (r) => {
      toast(r.jaEstava ? `${r.por} já tinha publicado` : "Marcado como publicado");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const pedir = useMutation({
    mutationFn: postAdminPublicacaoPedir,
    onSuccess: () => {
      toast("Pedido enviado. A Vênus faz em até 2 minutos.");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const alternarAvisos = async () => {
    try {
      if (avisos) await disablePush();
      else await enablePush();
    } catch {
      toast.error("Não consegui mudar os avisos neste celular.");
    }
  };

  const minutosSemApp = data?.appVistoEm ? Math.round((Date.now() - new Date(data.appVistoEm).getTime()) / 60_000) : null;
  const turnosComStory = new Set((data?.stories ?? []).map((st) => st.turno));
  const pedindoStory = (turno: string) => data?.pedidos.some((p) => p.tipo === "story_outro" && p.turno === turno && (p.estado === "pendente" || p.estado === "fazendo"));

  return (
    <div className={s.tela}>
      <Helmet>
        <title>Publicações | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0A0F24" />
      </Helmet>
      <div className={s.coluna}>
        <header className={s.topo}>
          <Link to="/admin" className={s.voltar} aria-label="Voltar ao painel">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className={s.titulo}>PUBLICAÇÕES</h1>
            <p className={s.subtitulo}>VÊNUS · DESEJO DE INTIMIDADE</p>
          </div>
        </header>
        <div className={s.orbe}>
          <VenusOrbe tamanho={120} estado={pedir.isPending ? "pensando" : "ocioso"} />
        </div>

        {data && (minutosSemApp === null || minutosSemApp > 10) ? (
          <p className={s.alerta}>
            {minutosSemApp === null
              ? "A Vênus do celular do Toni ainda não conferiu os pedidos. Atualize a Vênus app para a versão nova."
              : `A Vênus do celular do Toni não confere os pedidos há ${minutosSemApp >= 120 ? `${Math.round(minutosSemApp / 60)} h` : `${minutosSemApp} min`}. O celular pode estar desligado ou sem internet; os pedidos ficam na fila.`}
          </p>
        ) : null}

        {isLoading ? (
          <div className={`${s.cartao} ${s.carregando}`} />
        ) : isError || !data ? (
          <p className={s.alerta}>Não foi possível carregar as publicações.</p>
        ) : (
          <>
            <Secao titulo="Stories de hoje">
              {data.stories.length === 0 ? (
                <div className={s.linha}>
                  <div className={s.textos}>
                    <p className={s.tituloLinha}>Nenhum story ainda hoje</p>
                    <p className={s.descricao}>A Vênus manda o da manhã e o da tarde sozinha. Se quiser, peça agora.</p>
                  </div>
                </div>
              ) : null}
              {data.stories.map((st) => (
                <div key={st.id} className={s.linha}>
                  <img className={s.previa} src={st.imagemUrl} alt={`Story: ${st.titulo}`} loading="lazy" />
                  <div className={s.textos}>
                    <p className={s.tituloLinha}>Story da {nomeTurno(st.turno)}</p>
                    <p className={s.descricao}>{st.titulo}</p>
                    {st.enquete && st.pergunta ? (
                      <button className={s.enquete} onClick={() => navigator.clipboard.writeText(st.pergunta ?? "").then(() => toast("Pergunta copiada"))}>
                        <Copy size={13} /> Enquete: {st.pergunta}
                      </button>
                    ) : null}
                    <div className={s.acoes}>
                      {st.instagramPor ? (
                        <span className={s.feito}>
                          <Check size={13} /> Instagram: {st.instagramPor} {hora(st.instagramEm)}
                        </span>
                      ) : (
                        <>
                          <button className={s.botao} onClick={() => compartilhar(st, true)}>
                            <Instagram size={15} /> Publicar Instagram
                          </button>
                          <button className={s.botaoSecundario} disabled={marcar.isPending} onClick={() => marcar.mutate({ id: st.id, onde: "instagram" })}>
                            Já publiquei
                          </button>
                        </>
                      )}
                    </div>
                    <div className={s.acoes}>
                      {st.whatsappPor ? (
                        <span className={s.feito}>
                          <Check size={13} /> WhatsApp: {st.whatsappPor} {hora(st.whatsappEm)}
                        </span>
                      ) : (
                        <>
                          <button className={s.botao} onClick={() => compartilhar(st, false)}>
                            <MessageCircle size={15} /> Publicar WhatsApp
                          </button>
                          <button className={s.botaoSecundario} disabled={marcar.isPending} onClick={() => marcar.mutate({ id: st.id, onde: "whatsapp" })}>
                            Já pus no status
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(["manha", "tarde"] as const).map((turno) => (
                <button
                  key={turno}
                  className={s.linhaBotao}
                  disabled={pedir.isPending || pedindoStory(turno)}
                  onClick={() => pedir.mutate({ tipo: "story_outro", turno })}
                >
                  <div className={s.textos}>
                    <p className={s.tituloLinha}>{turnosComStory.has(turno) ? `Gerar outro story da ${nomeTurno(turno)}` : `Gerar o story da ${nomeTurno(turno)}`}</p>
                    <p className={s.descricao}>{pedindoStory(turno) ? "Pedido feito, a Vênus está montando." : "Não gostou? A Vênus monta outro com outro tema."}</p>
                  </div>
                  <RefreshCw size={18} className={s.icone} />
                </button>
              ))}
            </Secao>

            <Secao titulo="Ideias de post">
              {data.ideias.length === 0 ? (
                <div className={s.linha}>
                  <div className={s.textos}>
                    <p className={s.tituloLinha}>Nenhuma ideia ainda</p>
                    <p className={s.descricao}>A Vênus estuda as ideias uma vez por semana e manda para cá.</p>
                  </div>
                </div>
              ) : (
                data.ideias.map((ideia) => (
                  <LinhaIdeia
                    key={ideia.ref}
                    ideia={ideia}
                    ocupado={pedir.isPending}
                    aoPedir={(tipo, quando, legenda) => pedir.mutate({ tipo, ideiaRef: ideia.ref, quando: new Date(quando), legenda })}
                  />
                ))
              )}
            </Secao>

            {data.pedidos.length > 0 ? (
              <Secao titulo="Pedidos à Vênus">
                {data.pedidos.map((p) => (
                  <div key={p.id} className={s.linha}>
                    {p.imagemUrl ? <img className={s.previaPequena} src={p.imagemUrl} alt="" loading="lazy" /> : null}
                    <div className={s.textos}>
                      <p className={s.tituloLinha}>
                        {p.tipo === "story_outro" ? `Outro story da ${nomeTurno(p.turno)}` : `${p.tipo === "story" ? "Story" : "Post"}: ${p.ideiaTitulo ?? "ideia"}`}
                      </p>
                      <p className={s.descricao}>
                        {p.pedidoPor ? `${p.pedidoPor} · ` : ""}
                        {diaHora(p.criado)}
                        {p.quando ? ` · sai ${diaHora(p.quando)}` : ""}
                      </p>
                      {p.resultado ? <p className={s.descricao}>{p.resultado}</p> : null}
                    </div>
                    <span className={`${s.estado} ${p.estado === "erro" ? s.estadoErro : p.estado === "feito" ? s.estadoFeito : ""}`}>{ESTADO[p.estado]}</span>
                  </div>
                ))}
              </Secao>
            ) : null}

            <Secao titulo="Avisos">
              <button className={s.linhaBotao} onClick={alternarAvisos}>
                <div className={s.textos}>
                  <p className={s.tituloLinha}>{avisos ? "Avisos ligados neste celular" : "Receber avisos neste celular"}</p>
                  <p className={s.descricao}>Chega uma notificação quando o story ou o pedido fica pronto. No iPhone, abra pela Vênus da Loja na tela de início.</p>
                </div>
                {avisos ? <Bell size={18} className={s.icone} /> : <BellOff size={18} className={s.icone} />}
              </button>
            </Secao>
          </>
        )}
        <p className={s.rodape}>Vênus · feita para o seu dia a dia e para a sua loja</p>
      </div>
    </div>
  );
}