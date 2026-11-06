import React from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Badge } from "../components/Badge";
import { Switch } from "../components/Switch";
import { Skeleton } from "../components/Skeleton";
import { AdminNav } from "../components/AdminNav";
import { toast } from "../helpers/toast";
import { getAdminReviews } from "../endpoints/admin/reviews_GET.schema";
import { postReviewVisibility } from "../endpoints/admin/review_visibility_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.avaliacoes.module.css";

export default function AdminAvaliacoesPage() {
  const queryClient = useQueryClient();
  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => getAdminReviews(),
  });

  const toggle = useMutation({
    mutationFn: postReviewVisibility,
    onSuccess: (_r, vars) => {
      toast(vars.visible ? "Avaliação liberada para o site" : "Avaliação escondida do site");
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Avaliações | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Avaliações" current="/admin/avaliacoes" />
      <main className={styles.main}>
        <p className={styles.hint}>
          Na página inicial aparecem avaliações com nota 4 ou 5 e comentário.
          Na página de cada produto aparecem todas as avaliações do produto
          que estiverem liberadas. Desligue o interruptor para esconder qualquer
          uma.
        </p>
        {isFetching && !data ? (
          <Skeleton className={local.skeleton} />
        ) : isError ? (
          <p className={styles.error}>Não foi possível carregar as avaliações.</p>
        ) : data && data.reviews.length > 0 ? (
          <ul className={local.list}>
            {data.reviews.map((r) => {
              const onSite = r.visible && r.rating >= 4 && !!r.comment;
              return (
                <li key={r.id} className={local.item}>
                  <div className={local.head}>
                    <span className={local.stars} aria-label={`${r.rating} de 5`}>
                      {Array.from({ length: r.rating }, (_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </span>
                    <Badge variant="secondary">
                      {!r.visible
                        ? "Escondida"
                        : onSite
                          ? "Início e produto"
                          : r.kind === "service"
                            ? "Não aparece"
                            : "Só na página do produto"}
                    </Badge>
                  </div>
                  <p className={local.comment}>
                    {r.comment ? `“${r.comment}”` : "Sem comentário"}
                  </p>
                  <p className={local.meta}>
                    {r.displayName} ·{" "}
                    {r.kind === "service"
                      ? "Atendimento e entrega"
                      : (r.productName ?? "Produto")}{" "}
                    · Pedido #{r.orderId} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <label className={local.switchRow}>
                    <span>Mostrar no site</span>
                    <Switch
                      checked={r.visible}
                      disabled={toggle.isPending}
                      onCheckedChange={(visible) =>
                        toggle.mutate({ id: r.id, visible })
                      }
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>Nenhuma avaliação ainda.</p>
        )}
      </main>
    </div>
  );
}