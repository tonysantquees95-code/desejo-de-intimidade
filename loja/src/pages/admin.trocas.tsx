import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Textarea } from "../components/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { toast } from "../helpers/toast";
import { formatCents } from "../helpers/formatCents";
import { orderStatusLabels } from "../helpers/orderDto";
import { ESTADOS_TROCA, ESTADOS_TROCA_IDS, PRAZO_RESPOSTA_TROCA, nomePreferencia, nomeTipo, type EstadoTroca } from "../helpers/trocas";
import { getAdminTrocas, type SolicitacaoTroca } from "../endpoints/admin/trocas_GET.schema";
import { postAdminTroca } from "../endpoints/admin/troca_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.trocas.module.css";

const DIA = 86_400_000;

function linkWhatsapp(s: SolicitacaoTroca, estado: string, nota: string): string {
  const d = s.customerPhone.replace(/\D/g, "");
  const numero = d.length <= 11 ? `55${d}` : d;
  const nome = s.customerName.split(" ")[0];
  const extra = nota.trim() ? `\n\n${nota.trim()}` : "";
  const textos: Record<string, string> = {
    nova: `Olá, ${nome}! Recebemos sua solicitação de troca/devolução nº ${s.id} (pedido #${s.orderId}). Respondemos em até ${PRAZO_RESPOSTA_TROCA}.`,
    analise: `Olá, ${nome}! Sua solicitação nº ${s.id} (pedido #${s.orderId}) está em análise. Já já te respondemos por aqui.${extra}`,
    aprovada: `Olá, ${nome}! Sua solicitação nº ${s.id} (pedido #${s.orderId}) foi aprovada ✅${extra}`,
    recusada: `Olá, ${nome}! Analisamos sua solicitação nº ${s.id} (pedido #${s.orderId}).${extra}`,
    concluida: `Olá, ${nome}! Sua solicitação nº ${s.id} (pedido #${s.orderId}) foi concluída. Obrigada pela paciência 💖${extra}`,
  };
  return `https://wa.me/${numero}?text=${encodeURIComponent(textos[estado] ?? textos.nova)}`;
}

function Solicitacao({ s }: { s: SolicitacaoTroca }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoTroca>((ESTADOS_TROCA_IDS as string[]).includes(s.estado) ? (s.estado as EstadoTroca) : "nova");
  const [nota, setNota] = useState(s.resposta ?? "");
  const salvar = useMutation({
    mutationFn: postAdminTroca,
    onSuccess: () => {
      toast("Solicitação salva");
      queryClient.invalidateQueries({ queryKey: ["admin", "trocas"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const dias = Math.floor((new Date(s.criado).getTime() - new Date(s.orderUpdatedAt).getTime()) / DIA);
  const foraDoPrazo = s.orderStatus === "delivered" && ((s.tipo === "arrependimento" || s.tipo === "errado") ? dias > 7 : s.tipo === "troca" ? dias > 30 : false);

  return (
    <li className={local.item}>
      <div className={local.head}>
        <h2 className={local.titulo}>
          Nº {s.id} · <Link to="/admin/pedidos">pedido #{s.orderId}</Link>
        </h2>
        <Badge variant={s.estado === "nova" ? "primary" : s.estado === "concluida" ? "success" : "secondary"}>{ESTADOS_TROCA[s.estado as EstadoTroca] ?? s.estado}</Badge>
      </div>
      <dl className={local.dados}>
        <dt>Cliente</dt>
        <dd>{s.customerName}</dd>
        <dt>Motivo</dt>
        <dd>{nomeTipo(s.tipo)}</dd>
        <dt>Prefere</dt>
        <dd>{nomePreferencia(s.preferencia)}</dd>
        <dt>Itens</dt>
        <dd>{s.itens}</dd>
        <dt>O que houve</dt>
        <dd>{s.descricao}</dd>
        <dt>Pedido</dt>
        <dd>
          {formatCents(s.totalCents)} · {s.paymentMethod === "pix" ? "Pix" : "cartão"} · {orderStatusLabels[s.orderStatus]}
        </dd>
        <dt>Aberta em</dt>
        <dd>{new Date(s.criado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd>
      </dl>
      {foraDoPrazo ? (
        <p className={local.alerta}>
          Atenção: o pedido foi marcado como entregue há uns {dias} dias. Confira a data real de entrega no rastreio antes de decidir.
        </p>
      ) : null}
      <Textarea value={nota} rows={2} maxLength={1000} placeholder="Anotação ou resposta (vai junto na mensagem do WhatsApp)" onChange={(e) => setNota(e.target.value)} />
      <div className={local.acoes}>
        <Select value={estado} onValueChange={(v) => setEstado(v as EstadoTroca)}>
          <SelectTrigger className={local.estado} aria-label="Estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_TROCA_IDS.map((e) => (
              <SelectItem key={e} value={e}>
                {ESTADOS_TROCA[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={salvar.isPending} onClick={() => salvar.mutate({ id: s.id, estado, resposta: nota.trim() || null })}>
          Salvar
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={linkWhatsapp(s, estado, nota)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> Responder no WhatsApp
          </a>
        </Button>
      </div>
    </li>
  );
}

export default function AdminTrocasPage() {
  const { data, isFetching, isError } = useQuery({ queryKey: ["admin", "trocas"], queryFn: () => getAdminTrocas() });
  const abertas = data?.solicitacoes.filter((s) => s.estado !== "concluida" && s.estado !== "recusada").length ?? 0;
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Trocas | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Trocas e devoluções" current="/admin/trocas" />
      <main className={styles.main}>
        <p className={styles.hint}>
          As solicitações que as clientes abrem em <a href="/trocas">/trocas</a>. A cliente também manda tudo no WhatsApp, e o robô avisa
          que vocês respondem em até {PRAZO_RESPOSTA_TROCA}. {abertas > 0 ? `${abertas} em aberto.` : ""}
        </p>
        {isFetching && !data ? (
          <Skeleton className={local.skeleton} />
        ) : isError ? (
          <p className={styles.error}>Não foi possível carregar as solicitações.</p>
        ) : data && data.solicitacoes.length > 0 ? (
          <ul className={local.list}>
            {data.solicitacoes.map((s) => (
              <Solicitacao key={`${s.id}-${s.atualizado.toString()}`} s={s} />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Nenhuma solicitação ainda.</p>
        )}
      </main>
    </div>
  );
}