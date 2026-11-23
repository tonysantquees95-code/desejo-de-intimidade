import React, { useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { Selectable } from "kysely";
import type { Products, ProductCategory } from "../helpers/schema";
import { productCategories } from "../helpers/productCategories";
import {
  postUpload,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "../endpoints/admin/upload_POST.schema";
import type { InputType as ProductInput } from "../endpoints/admin/product_save_POST.schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { Spinner } from "./Spinner";
import { FileDropzone } from "./FileDropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { toast } from "../helpers/toast";
import { parsePriceToCents } from "../helpers/parsePriceToCents";
import styles from "./ProductFormDialog.module.css";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = creating a new product */
  product: Selectable<Products> | null;
  defaultCategory: ProductCategory;
  isSaving: boolean;
  onSubmit: (values: ProductInput) => void;
}

export const ProductFormDialog: React.FC<ProductFormDialogProps> = ({
  open,
  onOpenChange,
  product,
  defaultCategory,
  isSaving,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [promoText, setPromoText] = useState("");
  const [costText, setCostText] = useState("");
  const [specs, setSpecs] = useState("");
  const [stock, setStock] = useState("");
  const [weight, setWeight] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [length, setLength] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setCategory(product?.category ?? defaultCategory);
    setDescription(product?.description ?? "");
    const money = (cents: number | null | undefined) =>
      cents != null ? (cents / 100).toFixed(2).replace(".", ",") : "";
    // On a promotion, "normal price" is the original one and "promo" is what is charged.
    setPriceText(money(product?.compareAtCents ?? product?.priceCents));
    setPromoText(product?.compareAtCents != null ? money(product.priceCents) : "");
    setCostText(money(product?.costCents));
    setSpecs(product?.specifications ?? "");
    setStock(product?.stockQuantity != null ? String(product.stockQuantity) : "");
    setImageUrl(product?.imageUrl ?? null);
    setWeight(product?.weightGrams != null ? String(product.weightGrams) : "");
    setWidth(product?.widthCm != null ? String(product.widthCm) : "");
    setHeight(product?.heightCm != null ? String(product.heightCm) : "");
    setLength(product?.lengthCm != null ? String(product.lengthCm) : "");
    setActive(product?.active ?? true);
  }, [open, product, defaultCategory]);

  const handleFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { presignedUrl, headers, url } = await postUpload({
        contentType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
        sizeBytes: file.size,
      });
      const put = await fetch(presignedUrl, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!put.ok) throw new Error("Falha ao enviar a imagem.");
      setImageUrl(url);
      toast("Imagem enviada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    const num = (text: string) => {
      const n = Math.round(Number(text.trim().replace(",", ".")));
      return text.trim() && Number.isFinite(n) ? n : null;
    };
    const normal = parsePriceToCents(priceText);
    const promo = parsePriceToCents(promoText);
    if (promo !== null && (normal === null || promo >= normal)) {
      toast.error("O preço promocional precisa ser menor que o preço normal.");
      return;
    }
    onSubmit({
      id: product?.id,
      category,
      name,
      description: description.trim() || null,
      priceCents: promo !== null ? promo : normal,
      compareAtCents: promo !== null ? normal : null,
      specifications: specs.trim() || null,
      stockQuantity: (() => {
        const n = num(stock);
        return n === null ? null : Math.max(0, n);
      })(),
      weightGrams: num(weight),
      widthCm: num(width),
      heightCm: num(height),
      lengthCm: num(length),
      imageUrl,
      active,
      costCents: parsePriceToCents(costText),
    });
  };

  // Margem ao vivo enquanto digita: (preço cobrado − custo) ÷ preço cobrado
  const custoAgora = parsePriceToCents(costText);
  const precoAgora = parsePriceToCents(promoText) ?? parsePriceToCents(priceText);
  const margemTexto =
    custoAgora !== null && precoAgora !== null && precoAgora > 0
      ? (() => {
          const lucro = precoAgora - custoAgora;
          const pct = Math.round((lucro / precoAgora) * 100);
          const reais = (Math.abs(lucro) / 100).toFixed(2).replace(".", ",");
          return lucro >= 0
            ? `Lucro de R$ ${reais} por unidade (${pct}% do preço).`
            : `Atenção: vendendo por esse preço você perde R$ ${reais} por unidade.`;
        })()
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            O produto aparece no site e leva o cliente direto para o seu WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-name">
              Nome
            </label>
            <Input
              id="product-name"
              value={name}
              maxLength={120}
              placeholder="Ex.: Conjunto Renda Noir"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Categoria</span>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as ProductCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-description">
              Descrição curta
            </label>
            <Textarea
              id="product-description"
              value={description}
              maxLength={600}
              rows={5}
              placeholder="Ex.: Renda e algodão, tamanhos P ao GG"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-price">
              Preço normal em reais (necessário para vender no site)
            </label>
            <Input
              id="product-price"
              value={priceText}
              maxLength={40}
              placeholder="Ex.: 89,90"
              onChange={(e) => setPriceText(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-promo">
              Preço promocional (opcional)
            </label>
            <Input
              id="product-promo"
              value={promoText}
              maxLength={40}
              placeholder="Ex.: 69,90"
              onChange={(e) => setPromoText(e.target.value)}
            />
            <p className={styles.hint}>
              Preenchendo, o produto aparece na seção Promoções do site com o
              preço antigo riscado, e vende por este valor. Produtos em
              promoção não têm o desconto de 5% no Pix. Os demais ganham 5% de
              desconto no Pix automaticamente.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-cost">
              Preço de custo (só você vê)
            </label>
            <Input
              id="product-cost"
              value={costText}
              maxLength={40}
              inputMode="decimal"
              placeholder="Ex.: 32,50 — quanto você pagou por unidade"
              onChange={(e) => setCostText(e.target.value)}
            />
            <p className={styles.hint}>
              {margemTexto ??
                "Não aparece no site. Serve para a Vênus calcular margem, lucro e o resultado do mês."}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-specs">
              Especificações (opcional)
            </label>
            <Textarea
              id="product-specs"
              value={specs}
              maxLength={2000}
              rows={5}
              placeholder={"Uma por linha, no formato Nome: valor\nMaterial: silicone\nTamanho: 18 cm\nResistente à água: sim"}
              onChange={(e) => setSpecs(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="product-stock">
              Estoque (unidades)
            </label>
            <Input
              id="product-stock"
              value={stock}
              inputMode="numeric"
              placeholder="Ex.: 5 (em branco = não controlar)"
              onChange={(e) => setStock(e.target.value)}
            />
            <p className={styles.hint}>
              O estoque baixa sozinho a cada venda, e o produto mostra
              "Esgotado" quando chega a zero. Em branco, o site vende sem
              controlar a quantidade.
            </p>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Embalagem para o frete (opcional)</span>
            <p className={styles.hint}>
              Peso em gramas e tamanho da caixa em cm. Em branco, usa a caixa
              padrão de Pedidos e entrega. Quanto mais certo, mais exato o frete.
            </p>
            <div className={styles.dims}>
              <Input value={weight} inputMode="numeric" placeholder="Peso (g)" aria-label="Peso em gramas" onChange={(e) => setWeight(e.target.value)} />
              <Input value={length} inputMode="numeric" placeholder="Comprim. (cm)" aria-label="Comprimento em cm" onChange={(e) => setLength(e.target.value)} />
              <Input value={width} inputMode="numeric" placeholder="Largura (cm)" aria-label="Largura em cm" onChange={(e) => setWidth(e.target.value)} />
              <Input value={height} inputMode="numeric" placeholder="Altura (cm)" aria-label="Altura em cm" onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Foto</span>
            {imageUrl ? (
              <div className={styles.preview}>
                <img src={imageUrl} alt="Prévia do produto" className={styles.previewImg} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setImageUrl(null)}
                >
                  <Trash2 size={16} /> Remover foto
                </Button>
              </div>
            ) : null}
            {uploading ? (
              <div className={styles.uploading}>
                <Spinner size="sm" /> Enviando imagem...
              </div>
            ) : (
              <FileDropzone
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                maxSize={MAX_IMAGE_BYTES}
                onFilesSelected={handleFile}
                icon={<ImagePlus size={32} />}
                title={imageUrl ? "Trocar a foto" : "Clique ou arraste a foto aqui"}
                subtitle="PNG, JPG, WEBP ou GIF de até 8 MB"
              />
            )}
          </div>

          <div className={styles.switchRow}>
            <div>
              <span className={styles.label}>Mostrar no site</span>
              <p className={styles.hint}>Desligue para esconder sem excluir.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter className={styles.footer}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || uploading}>
              {isSaving ? "Salvando..." : "Salvar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
