import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Checkbox } from "../components/Checkbox";
import { Skeleton } from "../components/Skeleton";
import { RadioGroup, RadioGroupItem } from "../components/RadioGroup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useAuth } from "../helpers/useAuth";
import { useCatalog } from "../helpers/useCatalog";
import { toast } from "../helpers/toast";
import { formatCents } from "../helpers/formatCents";
import { orderStatusLabels } from "../helpers/orderDto";
import {
  AJUDA_TIPO,
  PRAZO_RESPOSTA_TROCA,
  PREFERENCIAS_TROCA,
  PREFERENCIAS_TROCA_IDS,
  TIPOS_TROCA,
  TIPOS_TROCA_IDS,
  type PreferenciaTroca,
  type TipoTroca,
} from "../helpers/trocas";
import { getMyOrders } from "../endpoints/shop/orders_GET.schema";
import { postTroca } from "../endpoints/shop/troca_POST.schema";
import styles from "./trocas.module.css";

const ATUALIZADA = "5 de novembro de 2026";

/** Formulário de solicitação: escolhe o pedido, os itens, o motivo e o que prefere; no fim abre o WhatsApp com tudo pronto. */
function Solicitar() {
  const { authState } = useAuth();
  const autenticada = authState.type === "authenticated";
  const catalog = useCatalog();
  const pedidos = useQuery({ queryKey: ["shop", "orders"], queryFn: () => getMyOrders(), enabled: autenticada });
  const enviados = useMemo(
    () => (pedidos.data?.orders ?? []).filter((o) => o.status === "shipped" || o.status === "delivered"),
    [pedidos.data],
  );

  const [pedidoId, setPedidoId] = useState<string>("");
  const [itens, setItens] = useState<string[]>([]);
  const [tipo, setTipo] = useState<TipoTroca | "">("");
  const [preferencia, setPreferencia] = useState<PreferenciaTroca | "">("");
  const [descricao, setDescricao] = useState("");
  const [pronta, setPronta] = useState<{ id: number; mensagem: string } | null>(null);

  const pedido = enviados.find((o) => String(o.id) === pedidoId);
  const enviar = useMutation({
    mutationFn: postTroca,
    onSuccess: (r) => {
      setPronta(r);
      document.getElementById("solicitar")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (authState.type === "loading") return <Skeleton style={{ height: "10rem" }} />;
  if (!autenticada) {
    return (
      <>
        <p className={styles.hint}>Para abrir uma solicitação, entre na conta que você usou para comprar.</p>
        <Button asChild>
          <Link to="/login?next=/trocas%23solicitar">Entrar para solicitar</Link>
        </Button>
      </>
    );
  }

  if (pronta) {
    const numero = catalog.data?.whatsappNumber ?? "";
    const link = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(pronta.mensagem)}` : null;
    return (
      <>
        <p className={styles.aviso}>
          Solicitação nº {pronta.id} registrada. Agora toque no botão para mandar no WhatsApp da loja. Lá, envie as fotos do produto e do
          problema e, se tiver, o vídeo da abertura da embalagem. Respondemos em até {PRAZO_RESPOSTA_TROCA}.
        </p>
        {link ? (
          <Button asChild size="lg">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} /> Enviar no WhatsApp
            </a>
          </Button>
        ) : (
          <p className={styles.hint}>Mande para a loja pelo WhatsApp a mensagem: “Solicitação de troca/devolução nº {pronta.id}”.</p>
        )}
      </>
    );
  }

  if (pedidos.isLoading) return <Skeleton style={{ height: "10rem" }} />;
  if (pedidos.isError) return <p className={styles.erro}>Não foi possível carregar seus pedidos. Tente de novo em instantes.</p>;
  if (enviados.length === 0) {
    return (
      <p className={styles.hint}>
        Você ainda não tem pedido enviado. Se o pedido ainda não saiu e você quer mudar ou cancelar, fale com a loja pelo WhatsApp.
      </p>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedido) return toast.error("Escolha o pedido.");
    if (itens.length === 0) return toast.error("Marque pelo menos um item.");
    if (!tipo) return toast.error("Escolha o motivo.");
    if (!preferencia) return toast.error("Escolha o que você prefere.");
    if (descricao.trim().length < 10) return toast.error("Conte com um pouco mais de detalhe o que aconteceu.");
    enviar.mutate({ orderId: pedido.id, tipo, preferencia, itens, descricao: descricao.trim() });
  };

  return (
    <form onSubmit={submit} className={styles.card} style={{ padding: 0, border: 0 }}>
      <div className={styles.campo}>
        <span className={styles.rotulo}>Pedido</span>
        <Select
          value={pedidoId}
          onValueChange={(v) => {
            setPedidoId(v);
            setItens([]);
          }}
        >
          <SelectTrigger aria-label="Pedido">
            <SelectValue placeholder="Escolha o pedido" />
          </SelectTrigger>
          <SelectContent>
            {enviados.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                #{o.id} · {new Date(o.createdAt).toLocaleDateString("pt-BR")} · {formatCents(o.totalCents)} · {orderStatusLabels[o.status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pedido ? (
        <div className={styles.campo}>
          <span className={styles.rotulo}>Quais itens</span>
          <div className={styles.itens}>
            {pedido.items.map((i) => {
              const nome = `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.name}`;
              return (
                <label key={i.id} className={styles.item}>
                  <Checkbox
                    checked={itens.includes(nome)}
                    onChange={(e) => setItens((l) => (e.target.checked ? [...l, nome] : l.filter((x) => x !== nome)))}
                  />
                  <span>{nome}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={styles.campo}>
        <span className={styles.rotulo}>Motivo</span>
        <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as TipoTroca)} aria-label="Motivo">
          {TIPOS_TROCA_IDS.map((t) => (
            <label key={t} htmlFor={`tipo-${t}`} className={styles.opcao} data-on={tipo === t}>
              <RadioGroupItem value={t} id={`tipo-${t}`} />
              <span className={styles.opcaoTexto}>
                {TIPOS_TROCA[t]}
                <small>{AJUDA_TIPO[t]}</small>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className={styles.campo}>
        <span className={styles.rotulo}>O que você prefere</span>
        <RadioGroup value={preferencia} onValueChange={(v) => setPreferencia(v as PreferenciaTroca)} aria-label="O que você prefere">
          {PREFERENCIAS_TROCA_IDS.map((p) => (
            <label key={p} htmlFor={`pref-${p}`} className={styles.opcao} data-on={preferencia === p}>
              <RadioGroupItem value={p} id={`pref-${p}`} />
              <span className={styles.opcaoTexto}>{PREFERENCIAS_TROCA[p]}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className={styles.campo}>
        <span className={styles.rotulo}>O que aconteceu</span>
        <Textarea
          value={descricao}
          rows={4}
          maxLength={1000}
          placeholder="Ex.: o vibrador não liga mesmo carregado; a calcinha veio no tamanho P e pedi M."
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <p className={styles.aviso}>
        Depois de enviar, abre o WhatsApp da loja com tudo preenchido. Mande lá as fotos do produto e do problema
        {tipo === "defeito" || tipo === "errado" ? " e o vídeo mostrando o defeito" : ""}. Se você gravou a abertura da embalagem, mande também:
        isso agiliza muito a análise.
      </p>
      <Button type="submit" size="lg" disabled={enviar.isPending}>
        {enviar.isPending ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </form>
  );
}

/** Política de trocas e devoluções + formulário de solicitação. */
export default function TrocasPage() {
  return (
    <ShopLayout title="Trocas e devoluções" subtitle={`Como desistir, trocar ou devolver uma compra. Atualizada em ${ATUALIZADA}.`}>
      <div className={styles.resumo}>
        <div className={styles.resumoItem}>
          <strong>Desistiu? 7 dias</strong>
          <span>Depois de receber, sem explicar. A loja paga o frete de volta.</span>
        </div>
        <div className={styles.resumoItem}>
          <strong>Defeito? Até 90 dias</strong>
          <span>Trocamos ou devolvemos o dinheiro. A loja paga o frete.</span>
        </div>
        <div className={styles.resumoItem}>
          <strong>Tamanho ou cor? 30 dias</strong>
          <span>Lingerie e fantasias sem uso, com etiqueta. Frete por conta da cliente.</span>
        </div>
      </div>

      <section id="solicitar" className={styles.card}>
        <h2 className={styles.cardTitle}>Solicitar troca ou devolução</h2>
        <Solicitar />
      </section>

      <article className={styles.texto}>
        <h2>1. Desistência da compra (arrependimento)</h2>
        <p>
          Compras pela internet podem ser desistidas em até <strong>7 dias corridos depois do recebimento</strong>, sem precisar dar
          motivo (art. 49 do Código de Defesa do Consumidor).
        </p>
        <ul>
          <li>O produto precisa voltar sem uso, com todos os itens e acessórios.</li>
          <li>
            Por higiene e segurança, produtos de uso íntimo (brinquedos, géis, óleos e cosméticos) precisam voltar com o lacre
            intacto.
          </li>
          <li>
            <strong>A loja paga o frete de volta:</strong> mandamos um código de postagem dos Correios; é só levar o pacote a uma agência
            e informar o código, sem pagar nada.
          </li>
          <li>Devolvemos o valor total, frete da compra incluído.</li>
        </ul>

        <h2>2. Produto com defeito</h2>
        <p>
          Avise em até <strong>30 dias</strong> (géis, óleos e cosméticos) ou <strong>90 dias</strong> (brinquedos, lingerie, fantasias e
          acessórios) depois de receber. Se o defeito aparecer com o uso, o prazo conta a partir de quando ele apareceu.
        </p>
        <ul>
          <li>Mande fotos e um vídeo mostrando o defeito, para a gente entender o problema.</li>
          <li>A loja paga o frete de ida e volta.</li>
          <li>
            Resolvemos em até 30 dias: troca pelo mesmo produto, troca por outro (pagando ou recebendo a diferença) ou devolução do
            valor.
          </li>
          <li>Não são defeito: desgaste natural, mau uso, uso de lubrificante incompatível com o material ou bateria que não foi carregada.</li>
        </ul>

        <h2>3. Produto errado, faltando ou avariado na entrega</h2>
        <p>
          Confira o pacote ao receber e avise em até <strong>7 dias</strong>. Mande fotos da caixa e do produto. Se você gravou um vídeo
          abrindo a embalagem, ele ajuda muito a resolver rápido (principalmente com os Correios). A loja paga todo o frete e envia o
          produto certo ou devolve o valor.
        </p>

        <h2>4. Troca por tamanho, cor ou modelo</h2>
        <p>
          Por gentileza da loja (não é obrigação legal), trocamos <strong>lingerie e fantasias</strong> em até <strong>30 dias</strong> depois
          do recebimento, sem uso, com a etiqueta e na embalagem original. O frete de ida e volta fica por conta da cliente. Brinquedos,
          géis, óleos e cosméticos não entram nesta troca, por higiene (dentro dos 7 dias vale a desistência do item 1).
        </p>

        <h2>5. Passo a passo</h2>
        <ol>
          <li>Preencha a solicitação acima (precisa estar na conta usada na compra).</li>
          <li>O WhatsApp da loja abre com tudo preenchido: envie a mensagem e, em seguida, as fotos e o vídeo.</li>
          <li>Respondemos em até {PRAZO_RESPOSTA_TROCA}.</li>
          <li>Aprovado, mandamos o código de postagem dos Correios (quando a loja paga o frete) ou o endereço para envio.</li>
          <li>Embale bem, com todos os itens, e poste. A embalagem de volta também pode ser discreta.</li>
          <li>Quando o produto chegar e for conferido, enviamos o produto novo ou devolvemos o valor.</li>
        </ol>

        <h2>6. Como o dinheiro volta</h2>
        <ul>
          <li>
            <strong>Cartão de crédito:</strong> pedimos o estorno ao Mercado Pago. O valor aparece na fatura em até 2 faturas, conforme o
            banco.
          </li>
          <li>
            <strong>Pix:</strong> devolvemos por Pix para a mesma conta que pagou.
          </li>
        </ul>

        <h2>7. Dúvidas</h2>
        <p>
          Fale com a gente pelo WhatsApp ou pelo e-mail <a href="mailto:desejodeintimidade@gmail.com">desejodeintimidade@gmail.com</a>. Veja
          também a <Link to="/privacidade">política de privacidade e os termos de uso</Link>.
        </p>
      </article>
    </ShopLayout>
  );
}