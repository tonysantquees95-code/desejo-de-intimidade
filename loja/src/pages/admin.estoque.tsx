import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { useAdminCatalog } from "../helpers/useAdminCatalog";
import { productCategories } from "../helpers/productCategories";
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "../helpers/stock";
import { toast } from "../helpers/toast";
import { postStockUpdate } from "../endpoints/admin/stock_update_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.estoque.module.css";

const order: Record<StockStatus, number> = { out: 0, low: 1, ok: 2, untracked: 3 };
const labels: Record<StockStatus, string> = {
  out: "Esgotado",
  low: "Estoque baixo",
  ok: "Em estoque",
  untracked: "Sem controle",
};

export default function AdminEstoquePage() {
  const queryClient = useQueryClient();
  const { query } = useAdminCatalog();
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const update = useMutation({
    mutationFn: postStockUpdate,
    onSuccess: (_result, vars) => {
      toast(vars.mode === "add" ? "Entrada registrada" : "Estoque atualizado");
      setInputs((prev) => ({ ...prev, [vars.productId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const products = [...(query.data?.products ?? [])].sort((a, b) => {
    const diff =
      order[stockStatus(a.stockQuantity)] - order[stockStatus(b.stockQuantity)];
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "pt-BR");
  });
  const count = (s: StockStatus) =>
    products.filter((p) => p.active && stockStatus(p.stockQuantity) === s).length;

  const submit = (productId: number, mode: "set" | "add") => {
    const raw = (inputs[productId] ?? "").trim();
    const n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < 0) {
      toast.error("Digite um número inteiro, de 0 para cima.");
      return;
    }
    update.mutate({ productId, quantity: n, mode });
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Estoque | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Estoque" current="/admin/estoque" />
      <main className={styles.main}>
        <p className={styles.hint}>
          O estoque baixa sozinho a cada venda e volta se o pagamento cair ou o
          Pix vencer. Quando um produto chega a {LOW_STOCK_THRESHOLD} unidades
          ou menos, e quando esgota, o aviso vai por e-mail para a conta de
          administrador. Produto sem estoque definido não é controlado.
        </p>

        <div className={local.chips}>
          <span className={`${local.chip} ${local.out}`}>Esgotados: {count("out")}</span>
          <span className={`${local.chip} ${local.low}`}>Baixo: {count("low")}</span>
          <span className={local.chip}>Em estoque: {count("ok")}</span>
          <span className={local.chip}>Sem controle: {count("untracked")}</span>
        </div>

        {query.isFetching && !query.data ? (
          <Skeleton className={local.skeleton} />
        ) : query.isError ? (
          <p className={styles.error}>Não foi possível carregar os produtos.</p>
        ) : (
          <ul className={local.list}>
            {products.map((p) => {
              const status = stockStatus(p.stockQuantity);
              const category = productCategories.find((c) => c.id === p.category);
              return (
                <li key={p.id} className={`${local.row} ${local[status]}`}>
                  <div className={local.info}>
                    <strong>{p.name}</strong>
                    <span className={local.meta}>
                      {category?.title}
                      {!p.active ? " · Escondido do site" : ""}
                    </span>
                  </div>
                  <div className={local.qty}>
                    <Badge variant="secondary">
                      {labels[status]}
                      {p.stockQuantity !== null ? `: ${p.stockQuantity}` : ""}
                    </Badge>
                  </div>
                  <div className={local.controls}>
                    <Input
                      value={inputs[p.id] ?? ""}
                      inputMode="numeric"
                      placeholder="Qtd"
                      aria-label={`Quantidade de ${p.name}`}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => submit(p.id, "set")}
                    >
                      <Save size={14} /> Definir total
                    </Button>
                    <Button
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => submit(p.id, "add")}
                    >
                      <Plus size={14} /> Entrada
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}