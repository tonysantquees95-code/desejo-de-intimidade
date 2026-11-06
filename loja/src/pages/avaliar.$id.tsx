import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { AuthLoadingState } from "../components/AuthLoadingState";
import { useAuth } from "../helpers/useAuth";
import { toast } from "../helpers/toast";
import { getOrder } from "../endpoints/shop/order_GET.schema";
import { postReviewCreate } from "../endpoints/shop/review_create_POST.schema";
import styles from "./avaliar.module.css";

type Entry = { rating: number; comment: string };

function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className={styles.stars} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          className={styles.starBtn}
          data-on={n <= value}
          onClick={() => onChange(n)}
        >
          <Star size={28} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export default function AvaliarPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const authenticated = authState.type === "authenticated";
  const validId = Number.isInteger(orderId) && orderId > 0;

  const { data, isError, error } = useQuery({
    queryKey: ["shop", "order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: authenticated && validId,
  });

  const [products, setProducts] = useState<Record<number, Entry>>({});
  const [service, setService] = useState<Entry>({ rating: 0, comment: "" });
  const [done, setDone] = useState(false);

  const send = useMutation({
    mutationFn: postReviewCreate,
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["shop", "order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (authState.type === "loading") {
    return <AuthLoadingState title="Carregando" />;
  }
  if (authState.type === "unauthenticated") {
    return <Navigate to={`/login?next=/avaliar/${id}`} replace />;
  }

  const order = data?.order;
  const items = order?.items.filter((i) => i.productId !== null) ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const productReviews = items.flatMap((i) => {
      const entry = products[i.productId as number];
      return entry && entry.rating > 0
        ? [
            {
              productId: i.productId as number,
              rating: entry.rating,
              comment: entry.comment.trim() || null,
            },
          ]
        : [];
    });
    if (productReviews.length === 0 && service.rating === 0) {
      toast.error("Toque nas estrelas para dar pelo menos uma nota.");
      return;
    }
    send.mutate({
      orderId,
      products: productReviews,
      service:
        service.rating > 0
          ? { rating: service.rating, comment: service.comment.trim() || null }
          : null,
    });
  };

  return (
    <ShopLayout title="Avaliar minha compra">
      {!validId || isError ? (
        <p className={styles.error}>
          {error instanceof Error ? error.message : "Pedido não encontrado."}
        </p>
      ) : !order ? (
        <Skeleton className={styles.skeleton} />
      ) : done || order.reviewed ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Obrigada pela avaliação! 💖</h2>
          <p className={styles.hint}>
            Sua opinião ajuda a loja a melhorar e outras pessoas a escolher.
          </p>
          <Button asChild>
            <Link to="/#categorias">Continuar comprando</Link>
          </Button>
        </section>
      ) : order.status !== "delivered" ? (
        <section className={styles.card}>
          <p className={styles.hint}>
            Você poderá avaliar assim que o pedido for entregue.
          </p>
          <Button asChild variant="outline">
            <Link to={`/pedido/${order.id}`}>Voltar ao pedido</Link>
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className={styles.form}>
          {items.map((i) => {
            const entry = products[i.productId as number] ?? { rating: 0, comment: "" };
            return (
              <section key={i.id} className={styles.card}>
                <h2 className={styles.cardTitle}>{i.name}</h2>
                <StarInput
                  label={`Nota para ${i.name}`}
                  value={entry.rating}
                  onChange={(rating) =>
                    setProducts((p) => ({
                      ...p,
                      [i.productId as number]: { ...entry, rating },
                    }))
                  }
                />
                <Textarea
                  value={entry.comment}
                  rows={3}
                  maxLength={500}
                  placeholder="O que achou do produto? (opcional)"
                  onChange={(e) =>
                    setProducts((p) => ({
                      ...p,
                      [i.productId as number]: { ...entry, comment: e.target.value },
                    }))
                  }
                />
              </section>
            );
          })}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Atendimento e entrega</h2>
            <StarInput
              label="Nota para o atendimento e a entrega"
              value={service.rating}
              onChange={(rating) => setService((s) => ({ ...s, rating }))}
            />
            <Textarea
              value={service.comment}
              rows={3}
              maxLength={500}
              placeholder="Como foi o atendimento, a embalagem e o prazo? (opcional)"
              onChange={(e) => setService((s) => ({ ...s, comment: e.target.value }))}
            />
          </section>
          <p className={styles.hint}>
            Seu comentário pode aparecer no site com seu primeiro nome e a
            inicial do sobrenome. Notas 4 e 5 com comentário são as exibidas.
          </p>
          <Button type="submit" size="lg" disabled={send.isPending}>
            {send.isPending ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </form>
      )}
    </ShopLayout>
  );
}