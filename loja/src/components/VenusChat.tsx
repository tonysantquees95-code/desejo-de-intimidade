import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { postVenusChat, type OutputType } from "../endpoints/venus/chat_POST.schema";
import { formatCents } from "../helpers/formatCents";
import { useAuth } from "../helpers/useAuth";
import { VenusOrbe, type VenusOrbeEstado } from "./VenusOrbe";
import { VenusLoja } from "./VenusLoja";
import styles from "./VenusChat.module.css";

type Mensagem =
  | { de: "cliente"; texto: string }
  | ({ de: "venus" } & OutputType);

const CHAVE = "venus-chat";
const BOAS_VINDAS: Mensagem = {
  de: "venus",
  texto:
    "Oi! Eu sou a Vênus, a atendente virtual da Desejo de Intimidade. Posso te ajudar a encontrar produtos, calcular o frete, explicar a entrega discreta ou ver seus pedidos.",
  produtos: [],
  acoes: [],
};
const SUGESTOES = ["Entrega discreta", "Formas de pagamento", "Calcular frete", "Meus pedidos", "Promoções"];

/**
 * Atendente virtual da loja: um orbe rosa no canto da tela que abre uma conversa.
 * A conversa fica guardada só nesta aba (some ao fechar o navegador).
 */
export const VenusChat = () => {
  const { authState } = useAuth();
  const admin = authState.type === "authenticated" && authState.user.role === "admin";
  // Administradora: abre direto nas funções da loja; a aba "Atendimento" mostra o que o cliente vê.
  const [modo, setModo] = useState<"loja" | "atendimento">("loja");
  // A Vênus da loja só carrega na primeira vez que o popup abre e depois fica guardada (não perde a conversa ao fechar).
  const [lojaCarregada, setLojaCarregada] = useState(false);
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  // Restaura a conversa ao trocar de página (só nesta aba).
  useEffect(() => {
    setMontado(true);
    try {
      const salvo = sessionStorage.getItem(CHAVE);
      if (salvo) {
        const dados = JSON.parse(salvo) as { aberto: boolean; mensagens: Mensagem[] };
        if (Array.isArray(dados.mensagens) && dados.mensagens.length > 0) setMensagens(dados.mensagens.slice(-40));
        setAberto(Boolean(dados.aberto));
      }
    } catch {
      // sem armazenamento: começa do zero
    }
  }, []);

  useEffect(() => {
    if (!montado) return;
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({ aberto, mensagens: mensagens.slice(-40) }));
    } catch {
      // ignora
    }
  }, [aberto, mensagens, montado]);

  useEffect(() => {
    if (admin && aberto) setLojaCarregada(true);
  }, [admin, aberto]);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens, aberto]);

  // Enquanto a resposta "chega", o orbe fica no modo falando, como no app.
  const [falando, setFalando] = useState(false);
  const falandoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const falar = (texto: string) => {
    if (falandoTimer.current) clearTimeout(falandoTimer.current);
    setFalando(true);
    falandoTimer.current = setTimeout(() => setFalando(false), Math.min(5000, Math.max(1500, texto.length * 30)));
  };
  useEffect(() => () => {
    if (falandoTimer.current) clearTimeout(falandoTimer.current);
  }, []);

  const enviar = useMutation({
    mutationFn: (mensagem: string) => postVenusChat({ mensagem }),
    onSuccess: (r) => {
      setMensagens((m) => [...m, { de: "venus", ...r }]);
      falar(r.texto);
    },
    onError: () =>
      setMensagens((m) => [
        ...m,
        { de: "venus", texto: "Não consegui responder agora. Pode tentar de novo em instantes?", produtos: [], acoes: [] },
      ]),
  });

  const mandar = (mensagem: string) => {
    const limpa = mensagem.trim().slice(0, 500);
    if (!limpa || enviar.isPending) return;
    setMensagens((m) => [...m, { de: "cliente", texto: limpa }]);
    setTexto("");
    enviar.mutate(limpa);
  };

  if (!montado) return null;

  const estado: VenusOrbeEstado = enviar.isPending ? "pensando" : falando ? "falando" : "ocioso";
  const mostrarAtendimento = !admin || modo === "atendimento";
  const mostrarPainel = aberto || (admin && lojaCarregada);

  return createPortal(
    <div className={styles.raiz}>
      {mostrarPainel ? (
        <section
          className={`${styles.painel} ${admin ? styles.painelAdmin : ""}`}
          style={aberto ? undefined : { display: "none" }}
          role="dialog"
          aria-label={admin ? "Vênus da loja" : "Atendimento da Vênus"}
        >
          <header className={styles.topo}>
            <span className={styles.orbePequeno} aria-hidden="true">
              <VenusOrbe tamanho={72} estado={estado} className={styles.orbeCanvas} />
            </span>
            <div className={styles.nomes}>
              <strong>Vênus</strong>
              <span>{admin ? "Administração da loja" : "Atendimento virtual · discreto"}</span>
            </div>
            <button type="button" className={styles.fechar} onClick={() => setAberto(false)} aria-label="Fechar atendimento">
              <X size={18} />
            </button>
          </header>

          {admin ? (
            <div className={styles.abas} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={modo === "loja"}
                className={`${styles.aba} ${modo === "loja" ? styles.abaAtiva : ""}`}
                onClick={() => setModo("loja")}
              >
                Loja
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === "atendimento"}
                className={`${styles.aba} ${modo === "atendimento" ? styles.abaAtiva : ""}`}
                onClick={() => setModo("atendimento")}
              >
                Atendimento
              </button>
            </div>
          ) : null}

          {admin && lojaCarregada ? (
            <div className={styles.lojaBox} style={modo === "loja" ? undefined : { display: "none" }}>
              <VenusLoja embutido />
            </div>
          ) : null}

          {mostrarAtendimento ? (
            <>
          <div className={styles.conversa}>
            {mensagens.map((m, i) =>
              m.de === "cliente" ? (
                <p key={i} className={`${styles.balao} ${styles.cliente}`}>
                  {m.texto}
                </p>
              ) : (
                <div key={i} className={styles.blocoVenus}>
                  <p className={`${styles.balao} ${styles.venus}`}>{m.texto}</p>
                  {m.produtos.length > 0 ? (
                    <div className={styles.produtos}>
                      {m.produtos.map((p) => (
                        <Link key={p.id} to={`/produto/${p.id}`} className={styles.produto} onClick={() => setAberto(false)}>
                          {p.imagem ? <img src={p.imagem} alt="" className={styles.foto} loading="lazy" /> : <span className={styles.foto} />}
                          <span className={styles.produtoTexto}>
                            <span className={styles.produtoNome}>{p.nome}</span>
                            <span className={styles.preco}>
                              {p.esgotado
                                ? "Esgotado"
                                : p.precoCents !== null
                                  ? `${formatCents(p.precoCents)}${p.pixCents !== null && p.pixCents < p.precoCents ? ` · ${formatCents(p.pixCents)} no Pix` : ""}`
                                  : "Consulte"}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {m.acoes.length > 0 ? (
                    <div className={styles.acoes}>
                      {m.acoes.map((a) =>
                        a.url.startsWith("/") ? (
                          <Link key={a.url} to={a.url} className={styles.acao} onClick={() => setAberto(false)}>
                            {a.rotulo}
                          </Link>
                        ) : (
                          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.acao}>
                            {a.rotulo}
                          </a>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {enviar.isPending ? (
              <p className={`${styles.balao} ${styles.venus} ${styles.digitando}`} aria-live="polite">
                <span />
                <span />
                <span />
              </p>
            ) : null}
            <div ref={fimRef} />
          </div>

          {mensagens.length <= 2 ? (
            <div className={styles.sugestoes}>
              {SUGESTOES.map((s) => (
                <button key={s} type="button" className={styles.sugestao} onClick={() => mandar(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className={styles.envio}
            onSubmit={(e) => {
              e.preventDefault();
              mandar(texto);
            }}
          >
            <input
              ref={campoRef}
              className={styles.campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua dúvida…"
              maxLength={500}
              aria-label="Sua mensagem"
            />
            <button type="submit" className={styles.enviar} disabled={!texto.trim() || enviar.isPending} aria-label="Enviar">
              <Send size={18} />
            </button>
          </form>
            </>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        className={`${styles.orbe} ${aberto ? styles.orbeAberto : ""}`}
        onClick={() => {
          setAberto((a) => !a);
          setTimeout(() => campoRef.current?.focus(), 50);
        }}
        aria-label={aberto ? "Fechar atendimento" : "Abrir atendimento da Vênus"}
        aria-expanded={aberto}
      >
        <span className={styles.orbeNucleo} aria-hidden="true">
          <VenusOrbe tamanho={aberto ? 104 : 136} estado={estado} className={styles.orbeCanvas} />
        </span>
        {!aberto ? <span className={styles.rotulo}>Dúvidas?</span> : null}
      </button>
    </div>,
    document.body,
  );
};
