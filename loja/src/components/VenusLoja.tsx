import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import { Mic, MicOff, Send, Volume2, VolumeX, Check, X, RefreshCw } from "lucide-react";
import { VenusOrbe, type VenusOrbeEstado } from "./VenusOrbe";
import { NovoProdutoVenus } from "./NovoProdutoVenus";
import { venusLoja, type VLAlteracao, type VLAcao, type VLPedido, type VLProduto } from "../helpers/venusLoja";
import { venusCadastro } from "../helpers/venusCadastro";
import { formatCents } from "../helpers/formatCents";
import { postAdminVenusIA, type VenusIAAcao } from "../endpoints/admin/venus_ia_POST.schema";
import styles from "./VenusLoja.module.css";

/* ------------------------------------------------------------------ dados do painel */

type Dados = { pedidos: VLPedido[]; produtos: VLProduto[] };

async function pedirAoPainel<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(caminho, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-venus-origem": "venus" },
    body: corpo === undefined ? undefined : superjson.stringify(corpo),
  });
  const texto = await r.text();
  let dados: unknown = null;
  try {
    dados = superjson.parse(texto);
  } catch {
    dados = null;
  }
  if (!r.ok) {
    const erro = (dados as { error?: string; message?: string } | null)?.error ?? (dados as { message?: string } | null)?.message;
    if (r.status === 401 || r.status === 403) throw new Error("Sua sessão expirou. Entre de novo no painel.");
    throw new Error(erro || `O site respondeu com erro ${r.status}.`);
  }
  return dados as T;
}

const data = (v: unknown): Date | null => (v instanceof Date ? v : v ? new Date(String(v)) : null);

async function carregarLoja(): Promise<Dados> {
  const [o, p] = await Promise.all([
    pedirAoPainel<{ orders: Record<string, unknown>[] }>("/_api/admin/orders"),
    pedirAoPainel<{ products: Record<string, unknown>[] }>("/_api/admin/products"),
  ]);
  const pedidos: VLPedido[] = (o?.orders ?? []).map((x) => ({
    id: Number(x.id),
    status: String(x.status ?? ""),
    totalCents: Number(x.totalCents ?? 0),
    customerName: String(x.customerName ?? ""),
    customerPhone: String(x.customerPhone ?? ""),
    deliveryMethod: String(x.deliveryMethod ?? ""),
    createdAt: data(x.createdAt) ?? new Date(0),
    paidAt: data(x.paidAt),
    trackingCode: x.trackingCode ? String(x.trackingCode) : null,
    discountCents: Number(x.discountCents ?? 0),
    shippingCents: Number(x.shippingCents ?? 0),
    items: Array.isArray(x.items)
      ? (x.items as Record<string, unknown>[]).map((i) => ({
          name: String(i.name ?? ""),
          quantity: Number(i.quantity ?? 1),
          unitPriceCents: Number(i.unitPriceCents ?? 0),
          productId: i.productId === null || i.productId === undefined ? null : Number(i.productId),
        }))
      : [],
  }));
  const produtos: VLProduto[] = (p?.products ?? []).map((x) => ({
    id: Number(x.id),
    name: String(x.name ?? ""),
    active: x.active !== false,
    stockQuantity: x.stockQuantity === null || x.stockQuantity === undefined ? null : Number(x.stockQuantity),
    priceCents: x.priceCents === null || x.priceCents === undefined ? null : Number(x.priceCents),
    compareAtCents: x.compareAtCents === null || x.compareAtCents === undefined ? null : Number(x.compareAtCents),
    bruto: x,
  }));
  return { pedidos, produtos };
}

/** Proposta da IA → a mesma mudança que o painel já sabe aplicar. */
function alteracaoDaIA(a: VenusIAAcao, produto: VLProduto): VLAlteracao | null {
  switch (a.tipo) {
    case "ativar":
      return { tipo: "ativar", produto };
    case "desativar":
      return { tipo: "desativar", produto };
    case "fim_promocao":
      return { tipo: "fim_promocao", produto };
    case "preco":
      return a.valor !== null ? { tipo: "preco", produto, valor: a.valor } : null;
    case "promocao":
      return a.valor !== null ? { tipo: "promocao", produto, valor: a.valor } : null;
    case "estoque":
      return a.valor !== null ? { tipo: "estoque", produto, valor: a.valor } : null;
    case "custo":
      return a.valor !== null ? { tipo: "custo", produto, valor: a.valor } : null;
  }
}

function descreverAcaoDaIA(a: VenusIAAcao, p: VLProduto): string {
  const atual = p.priceCents !== null ? formatCents(p.priceCents) : "sem preço";
  const motivo = a.motivo ? ` ${a.motivo}` : "";
  switch (a.tipo) {
    case "preco":
      return `Proposta: mudar o preço de ${p.name} de ${atual} para ${formatCents(a.valor ?? 0)}.${motivo}`;
    case "promocao":
      return `Proposta: ${p.name} em promoção por ${formatCents(a.valor ?? 0)} (hoje ${atual}).${motivo}`;
    case "fim_promocao":
      return `Proposta: tirar ${p.name} da promoção.${motivo}`;
    case "estoque":
      return `Proposta: deixar o estoque de ${p.name} em ${a.valor} unidades (hoje ${p.stockQuantity ?? "sem controle"}).${motivo}`;
    case "custo":
      return `Proposta: registrar o custo de ${p.name} como ${formatCents(a.valor ?? 0)}.${motivo}`;
    case "ativar":
      return `Proposta: mostrar ${p.name} no site.${motivo}`;
    case "desativar":
      return `Proposta: esconder ${p.name} do site.${motivo}`;
  }
}

async function aplicar(a: VLAlteracao): Promise<void> {
  switch (a.tipo) {
    case "estoque":
      await pedirAoPainel("/_api/admin/stock_update", { productId: a.produto.id, quantity: a.valor, mode: "set" });
      return;
    case "preco":
    case "ativar":
    case "desativar":
    case "promocao":
    case "fim_promocao":
    case "custo": {
      // relê o produto na hora, para não desfazer outra mudança feita pelo painel
      const atual = (await carregarLoja()).produtos.find((p) => p.id === a.produto.id);
      if (!atual) throw new Error(`Não achei mais ${a.produto.name} na loja.`);
      const corpo = venusLoja.corpoDoProduto(atual.bruto, a.tipo, a.tipo === "preco" || a.tipo === "promocao" || a.tipo === "custo" ? a.valor : undefined);
      if (!corpo) throw new Error(`Não consegui ler todos os dados de ${a.produto.name}. Faça pelo painel.`);
      await pedirAoPainel("/_api/admin/product_save", corpo);
      return;
    }
    case "entregue":
      await pedirAoPainel("/_api/admin/order_update", { id: a.pedido.id, status: "delivered", trackingCode: a.pedido.trackingCode });
      return;
    case "status":
      await pedirAoPainel("/_api/admin/order_update", { id: a.pedido.id, status: a.status, trackingCode: a.rastreio ?? a.pedido.trackingCode });
      return;
  }
}

/* ------------------------------------------------------------------ voz do navegador */

type Reconhecedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function criarReconhecedor(): Reconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
  const Classe = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Classe ? new Classe() : null;
}

function vozPortugues(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis?.getVoices() ?? [];
  return (
    vozes.find((v) => v.lang === "pt-BR" && /luciana|feminin|female|francisca|vitoria/i.test(v.name)) ??
    vozes.find((v) => v.lang === "pt-BR") ??
    vozes.find((v) => v.lang.startsWith("pt")) ??
    null
  );
}

const semEmoji = (t: string) => t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/R\$\s?/g, "").trim();

/* ------------------------------------------------------------------ tela */

type Mensagem = {
  id: number;
  de: "eu" | "venus";
  texto: string;
  acoes?: VLAcao[];
  alteracao?: VLAlteracao;
  situacao?: "esperando" | "salvando" | "feito" | "cancelado" | "erro";
};

const ATALHOS = ["Novidades", "Cadastrar produto", "Vendas de hoje", "Pedidos para separar", "Como está o estoque", "O que está acabando", "O que mudou hoje", "Como está o robô", "Ajuda"];

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PEDE_REGISTRO = /\b(o que (mudou|mudaram|foi (mudado|alterado|ajustado))|ajustes (de hoje|do dia|feitos)|registro de ajustes|log de ajustes|o que (voce|vc) (fez|mudou)|mudancas de hoje|o que (alteraram|ajustaram))\b/;
const PEDE_ROBO = /\b(robo|robozinho|atendimento automatico)\b/;
const hora = (d: Date | string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const CHAVE_VOZ = "venus-loja-falar";

/**
 * A Vênus da Loja: atendente interna para quem cuida da loja.
 * Fala e escreve; consulta e muda estoque, preços, produtos e pedidos pelas mesmas funções do painel.
 * Toda mudança espera confirmação (botão ou "sim").
 */
export const VenusLoja = ({ embutido = false }: { embutido?: boolean }) => {
  const queryClient = useQueryClient();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<VenusOrbeEstado>("ocioso");
  const [ouvindo, setOuvindo] = useState(false);
  const [falar, setFalar] = useState(true);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const proximoId = useRef(1);
  const pendente = useRef<{ id: number; alteracao: VLAlteracao } | null>(null);
  const reconhecedor = useRef<Reconhecedor | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const falandoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tela "Novo produto" aberta pela Vênus (null = fechada). */
  const [novoProduto, setNovoProduto] = useState<{ nome: string } | null>(null);

  useEffect(() => {
    setTemMicrofone(criarReconhecedor() !== null);
    try {
      setFalar(localStorage.getItem(CHAVE_VOZ) !== "0");
    } catch {
      // sem armazenamento: fala ligada
    }
    // as vozes do iPhone carregam depois
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensagens]);

  const dizer = useCallback(
    (t: string) => {
      if (falandoTimer.current) clearTimeout(falandoTimer.current);
      setEstado("falando");
      falandoTimer.current = setTimeout(() => setEstado("ocioso"), Math.min(9000, Math.max(1500, t.length * 55)));
      if (!falar || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(semEmoji(t));
      u.lang = "pt-BR";
      const v = vozPortugues();
      if (v) u.voice = v;
      u.onend = () => setEstado("ocioso");
      window.speechSynthesis.speak(u);
    },
    [falar],
  );

  const adicionar = useCallback((m: Omit<Mensagem, "id">) => {
    const id = proximoId.current++;
    setMensagens((lista) => [...lista.slice(-60), { ...m, id }]);
    return id;
  }, []);

  const mudarSituacao = (id: number, situacao: Mensagem["situacao"]) =>
    setMensagens((lista) => lista.map((m) => (m.id === id ? { ...m, situacao } : m)));

  /** Dados frescos (no máximo 20 s de idade) antes de responder. */
  const dados = useCallback(
    () => queryClient.fetchQuery({ queryKey: ["venus-loja", "dados"], queryFn: carregarLoja, staleTime: 20_000 }),
    [queryClient],
  );

  // Ao abrir: o que tem para fazer hoje.
  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    setEstado("pensando");
    dados()
      .then((d) => {
        const r = venusLoja.novidades(d.pedidos, d.produtos);
        adicionar({ de: "venus", texto: `Oi! ${r.texto} Pode falar ou escrever o que precisa.` });
        setEstado("ocioso");
      })
      .catch((e: Error) => {
        adicionar({ de: "venus", texto: `Não consegui abrir a loja: ${e.message}` });
        setEstado("ocioso");
      });
  }, [adicionar, dados]);

  const confirmar = async (id: number, alteracao: VLAlteracao) => {
    pendente.current = null;
    mudarSituacao(id, "salvando");
    setEstado("pensando");
    try {
      await aplicar(alteracao);
      mudarSituacao(id, "feito");
      queryClient.invalidateQueries({ queryKey: ["venus-loja", "dados"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      const t = venusLoja.confirmado(alteracao);
      const aviso = venusLoja.linkAviso(alteracao, window.location.origin);
      adicionar({ de: "venus", texto: t, acoes: aviso ? [{ rotulo: "Avisar a cliente no WhatsApp", url: aviso }] : undefined });
      dizer(t);
    } catch (e) {
      mudarSituacao(id, "erro");
      const t = `Não consegui salvar: ${e instanceof Error ? e.message : "erro desconhecido"} Nada foi mudado.`;
      adicionar({ de: "venus", texto: t });
      dizer(t);
    }
  };

  const cancelar = (id: number, avisar = true) => {
    if (pendente.current?.id === id) pendente.current = null;
    mudarSituacao(id, "cancelado");
    if (avisar) {
      const t = "Tudo bem, não mudei nada.";
      adicionar({ de: "venus", texto: t });
      dizer(t);
    }
  };

  /* ---------------------------------------------------------------- cadastro de produto novo */

  /** Abre a tela "Novo produto" (com o nome já preenchido, se a pessoa disse). */
  const abrirNovoProduto = (nome: string) => {
    setNovoProduto({ nome: nome.slice(0, 120) });
    const t = "Abri a tela de novo produto. Preencha e toque em Cadastrar produto.";
    adicionar({ de: "venus", texto: t });
    dizer(t);
  };

  const produtoCadastrado = (p: { id: number; name: string; priceCents: number | null; active: boolean }) => {
    setNovoProduto(null);
    queryClient.invalidateQueries({ queryKey: ["venus-loja", "dados"] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
    const preco = p.priceCents !== null ? ` por ${formatCents(p.priceCents)}` : "";
    const t = p.active
      ? `Pronto! Cadastrei ${p.name}${preco} e ele já está no site.`
      : `Pronto! Cadastrei ${p.name}${preco}. Ele ainda está escondido do site: para mostrar, diga ativar ${p.name}.`;
    adicionar({
      de: "venus",
      texto: t,
      acoes: [
        ...(p.active ? [{ rotulo: "Ver no site", url: `/produto/${p.id}` }] : []),
        { rotulo: "Editar no painel", url: "/admin" },
      ],
    });
    dizer(t);
  };

  const enviar = async (bruto: string) => {
    const frase = bruto.trim().slice(0, 300);
    if (!frase || estado === "pensando") return;
    // no iPhone a fala só funciona se começar a partir de um toque: "destrava" agora
    if (falar && window.speechSynthesis && !window.speechSynthesis.speaking) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
    setTexto("");
    adicionar({ de: "eu", texto: frase });

    // resposta a uma confirmação pendente
    const esperando = pendente.current;
    if (esperando !== null) {
      const sn = venusLoja.simOuNao(frase);
      if (sn === true) return confirmar(esperando.id, esperando.alteracao);
      if (sn === false) return cancelar(esperando.id);
      cancelar(esperando.id, false); // falou outra coisa: deixa a mudança de lado
    }

    const querCad = venusCadastro.querCadastrar(frase);
    if (querCad) return abrirNovoProduto(querCad.nome);

    // registro de ajustes e robô do WhatsApp/Instagram
    const chave = semAcento(frase);
    if (PEDE_REGISTRO.test(chave) || PEDE_ROBO.test(chave)) {
      setEstado("pensando");
      try {
        if (PEDE_REGISTRO.test(chave)) {
          const r = await pedirAoPainel<{ ajustes: { quando: Date; texto: string; origem: string; ok: boolean }[]; resumoHoje: string }>("/_api/admin/ajustes");
          const inicio = new Date();
          inicio.setHours(0, 0, 0, 0);
          const hoje = r.ajustes.filter((a) => new Date(a.quando) >= inicio).slice(0, 6);
          const lista = hoje.map((a) => `• ${hora(a.quando)} ${a.texto} (${a.origem})${a.ok ? "" : " — falhou"}`).join("\n");
          adicionar({ de: "venus", texto: lista ? `${r.resumoHoje}\n${lista}` : r.resumoHoje, acoes: [{ rotulo: "Ver o registro completo", url: "/admin/registro" }] });
          dizer(r.resumoHoje);
        } else {
          const r = await pedirAoPainel<{ ligado: boolean; hoje: { atendimentos: number; clientes: number; passadas: number }; esperando: unknown[] }>("/_api/admin/robo");
          const t = !r.ligado
            ? "O robô do WhatsApp e do Instagram está desligado. Dá para ligar na página Registro do painel."
            : `Hoje o robô atendeu ${r.hoje.clientes} ${r.hoje.clientes === 1 ? "cliente" : "clientes"} (${r.hoje.atendimentos} respostas)` +
              (r.esperando.length ? ` e ${r.esperando.length} ${r.esperando.length === 1 ? "cliente espera" : "clientes esperam"} você responder.` : ". Ninguém esperando você.");
          adicionar({ de: "venus", texto: t, acoes: [{ rotulo: "Abrir o robô no painel", url: "/admin/registro" }] });
          dizer(t);
        }
      } catch (e) {
        const t = `Não consegui ler agora: ${e instanceof Error ? e.message : "erro desconhecido"}`;
        adicionar({ de: "venus", texto: t });
        dizer(t);
      } finally {
        setEstado("ocioso");
      }
      return;
    }

    const intencao = venusLoja.interpretar(frase);
    if (!intencao) {
      // As regras não entenderam: a IA (com a memória vetorial da loja) analisa ou propõe mudanças em lote.
      // Cada mudança aparece com Confirmar/Cancelar; nada é salvo sem confirmação.
      setEstado("pensando");
      try {
        const r = await postAdminVenusIA({
          pedido: frase,
          conversa: mensagens.slice(-6).map((m) => ({ de: m.de, texto: m.texto.slice(0, 1500) })),
        });
        if (!r.disponivel) {
          adicionar({ de: "venus", texto: venusLoja.NAO_ENTENDI });
          dizer(venusLoja.NAO_ENTENDI);
          return;
        }
        const d = await dados();
        adicionar({ de: "venus", texto: r.texto });
        let falado = r.texto;
        for (const a of r.acoes) {
          const produto = d.produtos.find((p) => p.id === a.produtoId);
          if (!produto) continue;
          const alteracao = alteracaoDaIA(a, produto);
          if (!alteracao) continue;
          const id = adicionar({ de: "venus", texto: descreverAcaoDaIA(a, produto), alteracao, situacao: "esperando" });
          pendente.current = { id, alteracao };
        }
        if (r.acoes.length > 0) falado += " Confira cada mudança na tela e confirme as que quiser.";
        dizer(falado);
      } catch (e) {
        const t = `Não consegui pensar nisso agora: ${e instanceof Error ? e.message : "erro desconhecido"}`;
        adicionar({ de: "venus", texto: t });
        dizer(t);
      }
      return;
    }
    setEstado("pensando");
    try {
      const d = await dados();
      const r = venusLoja.responder(intencao, d.pedidos, d.produtos);
      const id = adicionar({ de: "venus", texto: r.texto, acoes: r.acoes, alteracao: r.alteracao, situacao: r.alteracao ? "esperando" : undefined });
      if (r.alteracao) pendente.current = { id, alteracao: r.alteracao };
      dizer(r.texto);
    } catch (e) {
      const t = `Não consegui consultar a loja: ${e instanceof Error ? e.message : "erro desconhecido"}`;
      adicionar({ de: "venus", texto: t });
      dizer(t);
    }
  };

  const ouvir = () => {
    if (ouvindo) {
      reconhecedor.current?.stop();
      return;
    }
    const r = criarReconhecedor();
    if (!r) return;
    window.speechSynthesis?.cancel();
    r.lang = "pt-BR";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const fala = e.results[0]?.[0]?.transcript ?? "";
      if (fala) void enviar(fala);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        adicionar({ de: "venus", texto: "O Safari não liberou o microfone. Toque em aA na barra de endereço, Ajustes do Site, e permita o Microfone." });
      }
    };
    r.onend = () => {
      setOuvindo(false);
      setEstado((s) => (s === "falando" ? s : "ocioso"));
    };
    reconhecedor.current = r;
    setOuvindo(true);
    setEstado("falando");
    try {
      r.start();
    } catch {
      setOuvindo(false);
    }
  };

  const alternarFala = () => {
    const novo = !falar;
    setFalar(novo);
    if (!novo) window.speechSynthesis?.cancel();
    try {
      localStorage.setItem(CHAVE_VOZ, novo ? "1" : "0");
    } catch {
      // ignora
    }
  };

  return (
    <section className={`${styles.raiz} ${embutido ? styles.embutido : ""}`} aria-label="Vênus da Loja">
      <header className={styles.topo}>
        <button type="button" className={styles.orbe} onClick={ouvir} aria-label={ouvindo ? "Parar de ouvir" : "Falar com a Vênus"} disabled={!temMicrofone}>
          <VenusOrbe tamanho={embutido ? 96 : 150} estado={ouvindo ? "falando" : estado} />
        </button>
        <p className={styles.status} aria-live="polite">
          {ouvindo ? "Ouvindo…" : estado === "pensando" ? "Consultando a loja…" : temMicrofone ? "Toque no orbe e fale" : "Escreva sua pergunta abaixo"}
        </p>
        <div className={styles.botoesTopo}>
          <button type="button" className={styles.icone} onClick={alternarFala} aria-label={falar ? "Desligar a voz" : "Ligar a voz"} title={falar ? "Voz ligada" : "Voz desligada"}>
            {falar ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button type="button" className={styles.icone} onClick={() => void enviar("novidades")} aria-label="Atualizar novidades" title="Novidades">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className={styles.conversa}>
        {mensagens.map((m) =>
          m.de === "eu" ? (
            <p key={m.id} className={`${styles.balao} ${styles.eu}`}>
              {m.texto}
            </p>
          ) : (
            <div key={m.id} className={styles.bloco}>
              <p className={`${styles.balao} ${styles.venus}`}>{m.texto}</p>
              {m.alteracao ? (
                m.situacao === "esperando" ? (
                  <div className={styles.confirmacao}>
                    <button type="button" className={styles.confirmar} onClick={() => m.alteracao && void confirmar(m.id, m.alteracao)}>
                      <Check size={16} /> Confirmar
                    </button>
                    <button type="button" className={styles.cancelar} onClick={() => cancelar(m.id)}>
                      <X size={16} /> Cancelar
                    </button>
                  </div>
                ) : (
                  <span className={styles.situacao} data-situacao={m.situacao}>
                    {{ salvando: "Salvando…", feito: "Feito ✓", cancelado: "Cancelado", erro: "Não salvou", esperando: "" }[m.situacao ?? "esperando"]}
                  </span>
                )
              ) : null}
              {m.acoes?.length ? (
                <div className={styles.acoes}>
                  {m.acoes.map((a) =>
                    a.url.startsWith("/") ? (
                      <Link key={a.url} to={a.url} className={styles.acao}>
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
        <div ref={fimRef} />
      </div>

      <div className={styles.atalhos}>
        {ATALHOS.map((a) => (
          <button key={a} type="button" className={styles.atalho} onClick={() => void enviar(a)}>
            {a}
          </button>
        ))}
      </div>

      <form
        className={styles.envio}
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <input
          className={styles.campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: coloca mais 5 unidades do gel"
          maxLength={300}
          aria-label="Mensagem para a Vênus"
          enterKeyHint="send"
        />
        {temMicrofone ? (
          <button type="button" className={`${styles.botao} ${ouvindo ? styles.ativo : ""}`} onClick={ouvir} aria-label={ouvindo ? "Parar de ouvir" : "Falar"}>
            {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        ) : null}
        <button type="submit" className={`${styles.botao} ${styles.enviar}`} disabled={!texto.trim()} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
      {novoProduto ? (
        <NovoProdutoVenus
          nomeInicial={novoProduto.nome}
          onClose={() => {
            setNovoProduto(null);
            const t = "Certo, não cadastrei nada.";
            adicionar({ de: "venus", texto: t });
            dizer(t);
          }}
          onCadastrado={produtoCadastrado}
        />
      ) : null}
    </section>
  );
};
