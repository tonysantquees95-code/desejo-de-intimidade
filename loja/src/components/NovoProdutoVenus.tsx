import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Camera, ImagePlus, Trash2 } from "lucide-react";
import type { Selectable } from "kysely";
import type { Products, ProductCategory } from "../helpers/schema";
import { productCategories } from "../helpers/productCategories";
import { parsePriceToCents } from "../helpers/parsePriceToCents";
import { formatCents } from "../helpers/formatCents";
import { postProductSave } from "../endpoints/admin/product_save_POST.schema";
import { postUpload, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../endpoints/admin/upload_POST.schema";
import { Switch } from "./Switch";
import styles from "./NovoProdutoVenus.module.css";

/**
 * Tela "Novo produto" que a Vênus abre quando você pede para cadastrar um produto.
 * Tela cheia, com os campos do produto, foto (câmera ou galeria) e o botão Cadastrar produto.
 */
export const NovoProdutoVenus = ({
  nomeInicial,
  onClose,
  onCadastrado,
}: {
  nomeInicial: string;
  onClose: () => void;
  onCadastrado: (produto: Selectable<Products>) => void;
}) => {
  const [nome, setNome] = useState(nomeInicial);
  const [categoria, setCategoria] = useState<ProductCategory>(productCategories[0].id);
  const [venda, setVenda] = useState("");
  const [custo, setCusto] = useState("");
  const [estoque, setEstoque] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  // trava a rolagem da página de trás enquanto a tela está aberta
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const enviarFoto = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro(null);
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(arquivo.type)) {
      setErro("Essa foto não serve. Use PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (arquivo.size > MAX_IMAGE_BYTES) {
      setErro("A foto passa de 8 MB. Escolha uma menor.");
      return;
    }
    setEnviando(true);
    try {
      const { presignedUrl, headers, url } = await postUpload({
        contentType: arquivo.type as (typeof ALLOWED_IMAGE_TYPES)[number],
        sizeBytes: arquivo.size,
      });
      const put = await fetch(presignedUrl, { method: "PUT", headers, body: arquivo });
      if (!put.ok) throw new Error("Falha ao enviar a imagem.");
      setImagem(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
    }
  };

  const vendaCents = parsePriceToCents(venda);
  const custoCents = parsePriceToCents(custo);
  const margem =
    vendaCents !== null && vendaCents > 0 && custoCents !== null
      ? (() => {
          const lucro = vendaCents - custoCents;
          const pct = Math.round((lucro / vendaCents) * 100);
          return lucro >= 0
            ? `Lucro de ${formatCents(lucro)} por unidade (${pct}% do preço).`
            : `Atenção: vendendo por esse preço você perde ${formatCents(-lucro)} por unidade.`;
        })()
      : null;

  const cadastrar = async () => {
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do produto.");
      return;
    }
    if (vendaCents === null || vendaCents <= 0) {
      setErro("Informe o preço de venda, por exemplo 29,90.");
      return;
    }
    if (vendaCents > 10_000_000 || (custoCents !== null && custoCents > 10_000_000)) {
      setErro("Esse valor está alto demais. Confira o preço.");
      return;
    }
    let estoqueNumero: number | null = null;
    if (estoque.trim()) {
      const n = Math.round(Number(estoque.trim().replace(",", ".")));
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        setErro("Estoque inválido. Use só o número de unidades, ou deixe vazio.");
        return;
      }
      estoqueNumero = n;
    }
    setSalvando(true);
    try {
      const r = await postProductSave({
        category: categoria,
        name: nome.trim(),
        description: descricao.trim() || null,
        priceCents: vendaCents,
        compareAtCents: null,
        specifications: null,
        stockQuantity: estoqueNumero,
        weightGrams: null,
        widthCm: null,
        heightCm: null,
        lengthCm: null,
        imageUrl: imagem,
        active: mostrar,
        costCents: custoCents,
      });
      onCadastrado(r.product);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar o produto.");
      setSalvando(false);
    }
  };

  const ocupado = salvando || enviando;

  return createPortal(
    <div className={styles.tela} role="dialog" aria-modal="true" aria-label="Novo produto">
      <header className={styles.topo}>
        <button type="button" className={styles.voltar} onClick={onClose} disabled={salvando} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className={styles.titulo}>Novo produto</h2>
          <p className={styles.sub}>Preencha, confira e cadastre na loja</p>
        </div>
      </header>

      <div className={styles.corpo}>
        <h3 className={styles.secao}>Produto</h3>
        <div className={styles.cartao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Nome</span>
            <input
              className={styles.entrada}
              value={nome}
              maxLength={120}
              placeholder="Ex.: Gel de massagem morango 60ml"
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Categoria</span>
            <select className={`${styles.entrada} ${styles.lista}`} value={categoria} onChange={(e) => setCategoria(e.target.value as ProductCategory)}>
              {productCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3 className={styles.secao}>Preço e estoque</h3>
        <div className={styles.cartao}>
          <div className={styles.duas}>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Preço de venda (R$)</span>
              <input className={styles.entrada} value={venda} inputMode="decimal" maxLength={20} placeholder="29,90" onChange={(e) => setVenda(e.target.value)} />
            </label>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Preço de custo (R$)</span>
              <input className={styles.entrada} value={custo} inputMode="decimal" maxLength={20} placeholder="15,00" onChange={(e) => setCusto(e.target.value)} />
            </label>
          </div>
          <p className={styles.dica}>{margem ?? "O custo só você vê. Com ele, a Vênus calcula o lucro de cada venda."}</p>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Estoque (unidades)</span>
            <input className={styles.entrada} value={estoque} inputMode="numeric" maxLength={6} placeholder="Vazio se não controla" onChange={(e) => setEstoque(e.target.value)} />
          </label>
        </div>

        <h3 className={styles.secao}>Foto</h3>
        <div className={styles.cartao}>
          {imagem ? (
            <div className={styles.previa}>
              <img src={imagem} alt="Prévia do produto" className={styles.previaImg} />
              <button type="button" className={styles.botaoFino} onClick={() => setImagem(null)}>
                <Trash2 size={16} /> Remover foto
              </button>
            </div>
          ) : (
            <p className={styles.dica}>{enviando ? "Enviando a foto…" : "Uma foto boa vende mais: fundo limpo e boa luz."}</p>
          )}
          <div className={styles.duas}>
            <button type="button" className={styles.botaoFoto} disabled={ocupado} onClick={() => cameraRef.current?.click()}>
              <Camera size={18} /> Câmera
            </button>
            <button type="button" className={styles.botaoFoto} disabled={ocupado} onClick={() => galeriaRef.current?.click()}>
              <ImagePlus size={18} /> Galeria
            </button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              void enviarFoto(arquivo);
            }}
          />
          <input
            ref={galeriaRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              void enviarFoto(arquivo);
            }}
          />
        </div>

        <h3 className={styles.secao}>Descrição</h3>
        <div className={styles.cartao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Texto que aparece no site</span>
            <textarea
              className={`${styles.entrada} ${styles.texto}`}
              value={descricao}
              maxLength={600}
              rows={5}
              placeholder="Descrição que vende a sensação (até 600 letras)"
              onChange={(e) => setDescricao(e.target.value)}
            />
          </label>
          <div className={styles.linhaSwitch}>
            <span className={styles.rotulo}>Já mostrar no site</span>
            <Switch checked={mostrar} onCheckedChange={setMostrar} />
          </div>
        </div>
      </div>

      <footer className={styles.rodape}>
        {erro ? (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        ) : null}
        <div className={styles.botoes}>
          <button type="button" className={styles.cancelar} onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className={styles.cadastrar} onClick={() => void cadastrar()} disabled={ocupado}>
            {salvando ? "Cadastrando…" : "Cadastrar produto"}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
};
