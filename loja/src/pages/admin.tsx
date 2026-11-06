import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Pencil, Plus, Trash2, Save } from "lucide-react";
import type { Selectable } from "kysely";
import type { Products, ProductCategory } from "../helpers/schema";
import { productCategories } from "../helpers/productCategories";
import { useAdminCatalog } from "../helpers/useAdminCatalog";
import { toast } from "../helpers/toast";
import { Button } from "../components/Button";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Switch } from "../components/Switch";
import { Skeleton } from "../components/Skeleton";
import { formatCents } from "../helpers/formatCents";
import { ProductFormDialog } from "../components/ProductFormDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/Dialog";
import styles from "./admin.module.css";

type Product = Selectable<Products>;

export default function AdminPage() {
  const { query, save, remove, saveWhatsapp } = useAdminCatalog();
  const { data, isFetching, isError, error } = query;

  const [whatsapp, setWhatsapp] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [newCategory, setNewCategory] = useState<ProductCategory>("geis_lubrificantes");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  useEffect(() => {
    if (data) setWhatsapp(data.whatsappNumber);
  }, [data]);

  const openNew = (category: ProductCategory) => {
    setEditing(null);
    setNewCategory(category);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

  const handleSave = (values: Parameters<typeof save.mutate>[0]) => {
    save.mutate(values, {
      onSuccess: () => {
        toast(values.id ? "Produto atualizado" : "Produto adicionado");
        setFormOpen(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const toggleActive = (product: Product, active: boolean) => {
    save.mutate(
      {
        id: product.id,
        category: product.category,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        weightGrams: product.weightGrams,
        widthCm: product.widthCm,
        heightCm: product.heightCm,
        lengthCm: product.lengthCm,
        compareAtCents: product.compareAtCents,
        specifications: product.specifications,
        stockQuantity: product.stockQuantity,
        imageUrl: product.imageUrl,
        active,
      },
      {
        onSuccess: () =>
          toast(active ? "Produto visível no site" : "Produto escondido do site"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id },
      {
        onSuccess: () => {
          toast("Produto excluído");
          setToDelete(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleSaveWhatsapp = (event: React.FormEvent) => {
    event.preventDefault();
    saveWhatsapp.mutate(
      { whatsappNumber: whatsapp },
      {
        onSuccess: (result) => {
          setWhatsapp(result.whatsappNumber);
          toast("WhatsApp atualizado");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Painel | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <AdminNav title="Painel da loja" current="/admin" />

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Número do WhatsApp</h2>
          <p className={styles.hint}>
            Os clientes são levados para este número ao clicar em um produto. Use
            DDI + DDD + número, sem espaços. Ex.: 5511999998888.
          </p>
          <form onSubmit={handleSaveWhatsapp} className={styles.whatsForm}>
            <Input
              value={whatsapp}
              inputMode="numeric"
              placeholder="5511999998888"
              onChange={(e) => setWhatsapp(e.target.value)}
              aria-label="Número do WhatsApp"
            />
            <Button type="submit" disabled={saveWhatsapp.isPending}>
              <Save size={16} /> {saveWhatsapp.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </section>

        {isError ? (
          <p className={styles.error}>
            {error instanceof Error ? error.message : "Erro ao carregar os produtos."}
          </p>
        ) : isFetching && !data ? (
          <div className={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={styles.rowSkeleton} />
            ))}
          </div>
        ) : (
          productCategories.map((category) => {
            const items = (data?.products ?? []).filter(
              (p) => p.category === category.id,
            );
            return (
              <section key={category.id} className={styles.categoryBlock}>
                <div className={styles.categoryHeader}>
                  <h2 className={styles.categoryTitle}>
                    {category.title}
                    <span className={styles.count}>{items.length}</span>
                  </h2>
                  <Button size="sm" onClick={() => openNew(category.id)}>
                    <Plus size={16} /> Adicionar produto
                  </Button>
                </div>

                {items.length === 0 ? (
                  <p className={styles.empty}>Nenhum produto nesta categoria ainda.</p>
                ) : (
                  <ul className={styles.list}>
                    {items.map((p) => (
                      <li key={p.id} className={styles.row}>
                        <div className={styles.thumb}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className={styles.thumbImg} />
                          ) : null}
                        </div>
                        <div className={styles.rowInfo}>
                          <span className={styles.rowName}>{p.name}</span>
                          <span className={styles.rowMeta}>
                            {p.priceCents !== null
                              ? formatCents(p.priceCents)
                              : "Sem preço"}
                            <Badge variant="secondary">
                              {p.costCents !== null
                                ? `Custo: ${formatCents(p.costCents)}`
                                : "Sem custo"}
                            </Badge>
                            {p.compareAtCents !== null &&
                            p.priceCents !== null &&
                            p.compareAtCents > p.priceCents ? (
                              <Badge variant="secondary">Promoção</Badge>
                            ) : null}
                            {p.stockQuantity !== null ? (
                              <Badge variant="secondary">
                                {p.stockQuantity <= 0
                                  ? "Esgotado"
                                  : `Estoque: ${p.stockQuantity}`}
                              </Badge>
                            ) : null}
                            {!p.active ? (
                              <Badge variant="secondary">Escondido</Badge>
                            ) : null}
                          </span>
                        </div>
                        <div className={styles.rowActions}>
                          <Switch
                            checked={p.active}
                            onCheckedChange={(checked) => toggleActive(p, checked)}
                            aria-label={`Mostrar ${p.name} no site`}
                          />
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => openEdit(p)}
                            aria-label={`Editar ${p.name}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setToDelete(p)}
                            aria-label={`Excluir ${p.name}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </main>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        defaultCategory={newCategory}
        isSaving={save.isPending}
        onSubmit={handleSave}
      />

      <Dialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto?</DialogTitle>
            <DialogDescription>
              “{toDelete?.name}” será removido do site. Se só quiser esconder, use o
              botão de visibilidade na lista.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
