import React, { useEffect, useState } from "react";
import { Download, Share, SquarePlus, MoreVertical, X } from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import styles from "./InstalarApp.module.css";

/* ------------------------------------------------------------------ instalação (PWA) */

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// O Android (Chrome) avisa uma vez que dá para instalar: guarda o aviso para usar quando a pessoa tocar no botão.
let avisoGuardado: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    avisoGuardado = e as EventoInstalar;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    avisoGuardado = null;
    ouvintes.forEach((f) => f());
  });
}

type Sistema = "ios" | "android" | "outro";

function qualSistema(): Sistema {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "outro";
}

function jaInstalado(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    // Dentro do app Android da loja (APK), que expõe esta ponte nas páginas.
    typeof (window as Window & { DesejoContas?: unknown }).DesejoContas !== "undefined"
  );
}

/** Navegador de dentro do Instagram, Facebook ou WhatsApp: lá não dá para instalar. */
const navegadorInterno = () => /instagram|fban|fbav|fb_iab|line\/|whatsapp/i.test(navigator.userAgent);

const CHAVE_FECHADO = "instalar-app-fechado";

/**
 * APK oficial da loja (versão 1.0.11), hospedado no próprio site.
 * Ao lançar uma versão nova: suba o APK, troque este caminho E atualize static/app-versao.json
 * (é o arquivo que faz o app instalado mostrar "Nova versão disponível").
 */
const APK_LOJA = "/_cdn/static/d28beb25-9e53-4991-912d-abc1ec642440-desejo-de-intimidade-1.0.11.apk";
const NOME_ARQUIVO_APK = "desejo-de-intimidade.apk";

function baixarApk(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = NOME_ARQUIVO_APK;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Botão "Baixar o app": no Android baixa o APK da loja na hora; no iPhone mostra como
 * colocar o site na Tela de Início (o Safari não deixa instalar por botão). Some quando já está instalado.
 * variante "faixa": aviso fino no celular, que pode ser fechado (volta depois de 15 dias).
 * apk={null}: sem APK (ex.: Vênus da Loja), o Android usa a instalação do navegador.
 */
export const InstalarApp = ({
  rotulo = "Baixar o app da loja",
  nome = "Desejo de Intimidade",
  variante = "botao",
  apk = APK_LOJA,
  className,
}: {
  rotulo?: string;
  nome?: string;
  variante?: "botao" | "faixa";
  apk?: string | null;
  className?: string;
}) => {
  const [pronto, setPronto] = useState(false);
  const [sistema, setSistema] = useState<Sistema>("outro");
  const [instalado, setInstalado] = useState(false);
  const [podeInstalar, setPodeInstalar] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    setSistema(qualSistema());
    setInstalado(jaInstalado());
    setPodeInstalar(avisoGuardado !== null);
    try {
      const quando = Number(localStorage.getItem(CHAVE_FECHADO) ?? 0);
      setFechado(Date.now() - quando < 15 * 24 * 3600 * 1000);
    } catch {
      // sem armazenamento: mostra
    }
    const atualizar = () => {
      setPodeInstalar(avisoGuardado !== null);
      setInstalado(jaInstalado());
    };
    ouvintes.add(atualizar);
    setPronto(true);
    return () => {
      ouvintes.delete(atualizar);
    };
  }, []);

  if (!pronto || instalado) return null;
  if (variante === "faixa" && (fechado || sistema === "outro")) return null;

  const instalar = async () => {
    if (sistema === "android" && apk) {
      baixarApk(apk);
      setAjuda(true);
      return;
    }
    if (avisoGuardado) {
      const aviso = avisoGuardado;
      await aviso.prompt();
      const escolha = await aviso.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (escolha.outcome === "accepted") avisoGuardado = null;
      setPodeInstalar(avisoGuardado !== null);
      return;
    }
    setAjuda(true);
  };

  const fecharFaixa = () => {
    setFechado(true);
    try {
      localStorage.setItem(CHAVE_FECHADO, String(Date.now()));
    } catch {
      // ignora
    }
  };

  const usaApk = sistema === "android" && Boolean(apk);
  const textoBotao = sistema === "ios" ? "Instalar no iPhone" : usaApk ? "Baixar o app para Android" : rotulo;

  return (
    <>
      {variante === "faixa" ? (
        <div className={`${styles.faixa} ${className ?? ""}`}>
          <Download size={16} className={styles.faixaIcone} />
          <span className={styles.faixaTexto}>Tenha a {nome} no seu celular, como um app.</span>
          <button type="button" className={styles.faixaBotao} onClick={() => void instalar()}>
            {sistema === "ios" ? "Ver como" : usaApk ? "Baixar" : podeInstalar ? "Instalar" : "Ver como"}
          </button>
          <button type="button" className={styles.faixaFechar} onClick={fecharFaixa} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="lg" className={`${styles.botao} ${className ?? ""}`} onClick={() => void instalar()}>
          <Download /> {textoBotao}
        </Button>
      )}

      <Dialog open={ajuda} onOpenChange={setAjuda}>
        <DialogContent className={styles.dialogo}>
          <DialogHeader>
            <DialogTitle>
              {sistema === "ios" ? "Colocar na Tela de Início do iPhone" : usaApk ? "Baixando o app…" : `Instalar ${nome}`}
            </DialogTitle>
            <DialogDescription>
              Fica com ícone próprio, abre em tela cheia como um app e não ocupa espaço no celular.
            </DialogDescription>
          </DialogHeader>

          {navegadorInterno() ? (
            <p className={styles.alerta}>
              Você está no navegador de dentro de outro app (Instagram, Facebook ou WhatsApp). Toque nos três pontinhos
              e escolha <strong>Abrir no {sistema === "ios" ? "Safari" : "navegador"}</strong> antes de seguir os passos.
            </p>
          ) : null}

          {sistema === "ios" ? (
            <ol className={styles.passos}>
              <li>
                No <strong>Safari</strong>, toque no botão <strong>Compartilhar</strong>{" "}
                <Share size={16} className={styles.iconeInline} aria-label="ícone de compartilhar" /> (na barra de baixo ou de cima).
              </li>
              <li>
                Role a lista e toque em <strong>Adicionar à Tela de Início</strong>{" "}
                <SquarePlus size={16} className={styles.iconeInline} aria-label="ícone de adicionar" />.
              </li>
              <li>
                Toque em <strong>Adicionar</strong>. Pronto: o ícone aparece junto dos seus apps.
              </li>
            </ol>
          ) : usaApk && apk ? (
            <>
              <ol className={styles.passos}>
                <li>
                  Quando o download terminar, toque no arquivo <strong>{NOME_ARQUIVO_APK}</strong> (na notificação ou na pasta
                  Downloads).
                </li>
                <li>
                  Se o celular pedir, toque em <strong>Configurações</strong> e permita instalar apps deste navegador. É só na
                  primeira vez.
                </li>
                <li>
                  Toque em <strong>Instalar</strong>. Pronto: o ícone aparece junto dos seus apps.
                </li>
              </ol>
              <Button type="button" variant="outline" onClick={() => baixarApk(apk)}>
                <Download /> Baixar de novo
              </Button>
            </>
          ) : sistema === "android" ? (
            <ol className={styles.passos}>
              <li>
                Toque no menu do navegador <MoreVertical size={16} className={styles.iconeInline} aria-label="três pontinhos" /> (três
                pontinhos, no canto de cima).
              </li>
              <li>
                Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
              </li>
              <li>
                Confirme em <strong>Instalar</strong>. O ícone aparece junto dos seus apps.
              </li>
            </ol>
          ) : (
            <ol className={styles.passos}>
              <li>No celular, abra este site e toque em “Baixar o app”.</li>
              <li>No computador (Chrome ou Edge), clique no ícone de instalar no fim da barra de endereço.</li>
            </ol>
          )}
          <Button type="button" onClick={() => setAjuda(false)}>
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
