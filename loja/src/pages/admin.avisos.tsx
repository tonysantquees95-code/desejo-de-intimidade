import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Send, Smartphone } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { toast } from "../helpers/toast";
import { getAdminAvisos } from "../endpoints/admin/avisos_GET.schema";
import { postAvisoEnviar, type InputType } from "../endpoints/admin/aviso_enviar_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.avisos.module.css";

const ATALHOS = [
  { rotulo: "Página inicial", url: "/" },
  { rotulo: "Promoções", url: "/#promocoes" },
  { rotulo: "Categorias", url: "/#categorias" },
  { rotulo: "Kits para Casais", url: "/categoria/kits-para-casais" },
];

export default function AdminAvisosPage() {
  const queryClient = useQueryClient();
  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "avisos"],
    queryFn: () => getAdminAvisos(),
  });

  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [url, setUrl] = useState("/#promocoes");
  const [confirmando, setConfirmando] = useState(false);

  const enviar = useMutation({
    mutationFn: (destino: InputType["destino"]) => postAvisoEnviar({ titulo, texto, url, destino }),
    onSuccess: (r, destino) => {
      setConfirmando(false);
      const extra = r.falhas > 0 ? ` (${r.falhas} não chegaram${r.removidos ? `; ${r.removidos} celulares sem o app foram tirados da lista` : ""})` : "";
      toast(destino === "teste" ? `Teste enviado para ${r.enviados} celular(es) seu(s)${extra}` : `Aviso enviado para ${r.enviados} celulares${extra}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "avisos"] });
    },
    onError: (err) => {
      setConfirmando(false);
      toast.error(err.message);
    },
  });

  const preenchido = titulo.trim().length > 0 && texto.trim().length > 0;
  const pronto = Boolean(data?.firebasePronto);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Avisos | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Avisos" current="/admin/avisos" />
      <main className={styles.main}>
        <p className={styles.hint}>
          Notificações para quem tem o app Android da loja e aceitou receber avisos. O aviso de
          <strong> pedido enviado</strong> sai sozinho quando o pedido muda para “Enviado”. Aqui você
          manda promoções e novidades. Use textos discretos: na tela bloqueada o conteúdo fica escondido,
          mas ao desbloquear qualquer pessoa com o celular na mão pode ler.
        </p>

        {isFetching && !data ? (
          <Skeleton className={local.skeleton} />
        ) : isError ? (
          <p className={styles.error}>Não foi possível carregar os avisos.</p>
        ) : data ? (
          <div className={local.numeros}>
            <div className={local.numero}>
              <Smartphone size={18} aria-hidden />
              <strong>{data.aparelhos}</strong>
              <span>celulares recebem avisos</span>
            </div>
            <div className={local.numero}>
              <Bell size={18} aria-hidden />
              <strong>{data.comConta}</strong>
              <span>ligados a uma conta</span>
            </div>
          </div>
        ) : null}

        {data && !pronto ? (
          <p className={local.alerta}>
            Falta cadastrar a chave do Firebase para os avisos poderem sair.
          </p>
        ) : null}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Novo aviso</h2>
          <div className={local.form}>
            <label className={local.campo}>
              <span>Título</span>
              <Input
                value={titulo}
                maxLength={65}
                placeholder="Ex.: Fim de semana com 15% off"
                onChange={(e) => setTitulo(e.target.value)}
              />
              <small>{titulo.length}/65</small>
            </label>
            <label className={local.campo}>
              <span>Mensagem</span>
              <Textarea
                value={texto}
                maxLength={180}
                rows={3}
                placeholder="Ex.: Selecionamos produtos com desconto até domingo. Toque para ver."
                onChange={(e) => setTexto(e.target.value)}
              />
              <small>{texto.length}/180</small>
            </label>
            <div className={local.campo}>
              <span>Ao tocar, abre</span>
              <div className={local.atalhos}>
                {ATALHOS.map((a) => (
                  <button
                    key={a.url}
                    type="button"
                    className={`${local.atalho} ${url === a.url ? local.atalhoAtivo : ""}`}
                    onClick={() => setUrl(a.url)}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/" aria-label="Página que abre ao tocar" />
              <small>Pode ser qualquer página da loja, por exemplo /produto/12.</small>
            </div>

            <div className={local.previa} aria-label="Prévia do aviso">
              <div className={local.previaTopo}>
                <Bell size={12} aria-hidden /> Desejo de Intimidade · agora
              </div>
              <strong>{titulo || "Título do aviso"}</strong>
              <span>{texto || "A mensagem aparece aqui."}</span>
            </div>

            <div className={local.acoes}>
              <Button
                type="button"
                variant="outline"
                disabled={!preenchido || !pronto || enviar.isPending}
                onClick={() => enviar.mutate("teste")}
              >
                <Smartphone size={16} /> Enviar teste para mim
              </Button>
              {confirmando ? (
                <Button
                  type="button"
                  disabled={enviar.isPending}
                  onClick={() => enviar.mutate("todos")}
                >
                  <Send size={16} /> Confirmar: enviar para {data?.aparelhos ?? 0} celulares
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!preenchido || !pronto || !data?.aparelhos || enviar.isPending}
                  onClick={() => setConfirmando(true)}
                >
                  <Send size={16} /> Enviar para todos
                </Button>
              )}
            </div>
            {data && data.meus === 0 ? (
              <small className={local.dica}>
                Para receber o teste: no seu celular, abra o app, ative os avisos e entre com esta conta.
              </small>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
