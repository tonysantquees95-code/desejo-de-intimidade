import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, QrCode, Store, Truck } from "lucide-react";
import { ShopLayout } from "../components/ShopLayout";
import { AvisoPagamento } from "../components/RodapeVetorial";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { AuthLoadingState } from "../components/AuthLoadingState";
import { useAuth } from "../helpers/useAuth";
import { useCart } from "../helpers/cart";
import { useCatalog } from "../helpers/useCatalog";
import { formatCents } from "../helpers/formatCents";
import { isPromotion, pixDiscountForLine } from "../helpers/pricing";
import { isValidCpf } from "../helpers/isValidCpf";
import { toast } from "../helpers/toast";
import { getProfile } from "../endpoints/shop/profile_GET.schema";
import { postShippingQuote } from "../endpoints/shop/shipping_quote_POST.schema";
import { postOrderCreate } from "../endpoints/shop/order_create_POST.schema";
import styles from "./checkout.module.css";

const digits = (v: string) => v.replace(/\D/g, "");
const maskCpf = (v: string) =>
  digits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCep = (v: string) => {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export default function CheckoutPage() {
  const { authState } = useAuth();
  const cart = useCart();
  const catalog = useCatalog();
  const authenticated = authState.type === "authenticated";

  const profile = useQuery({
    queryKey: ["shop", "profile"],
    queryFn: () => getProfile(),
    enabled: authenticated,
  });

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [delivery, setDelivery] = useState<"sedex" | "pickup" | "motoboy">("sedex");
  const [pickupAgree, setPickupAgree] = useState(false);
  const [shippingService, setShippingService] = useState<"sedex" | "pac" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lastCep = useRef("");
  const prefilled = useRef(false);

  // Prefill from the saved customer profile, once.
  useEffect(() => {
    const p = profile.data;
    if (!p || prefilled.current) return;
    prefilled.current = true;
    setName(p.name);
    setCpf(maskCpf(p.cpf));
    setPhone(maskPhone(p.phone));
    setCep(maskCep(p.address.cep));
    lastCep.current = digits(p.address.cep);
    setStreet(p.address.street);
    setStreetNumber(p.address.number);
    setComplement(p.address.complement);
    setNeighborhood(p.address.neighborhood);
    setCity(p.address.city);
    setState(p.address.state);
  }, [profile.data]);

  // Fill the address from the CEP (ViaCEP is a public, free service).
  const cepDigits = digits(cep);
  useEffect(() => {
    if (cepDigits.length !== 8 || cepDigits === lastCep.current) return;
    lastCep.current = cepDigits;
    fetch(`https://viacep.com.br/ws/${cepDigits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.erro) {
          toast.error("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }
        setStreet(data.logradouro ?? "");
        setNeighborhood(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setState(data.uf ?? "");
      })
      .catch(() => toast.error("Não foi possível buscar o CEP agora."));
  }, [cepDigits]);

  const quote = useQuery({
    queryKey: [
      "shop",
      "quote",
      cepDigits.length === 8 ? cepDigits : null,
      JSON.stringify(cart.lines),
    ],
    queryFn: () =>
      postShippingQuote({
        cep: cepDigits.length === 8 ? cepDigits : null,
        items: cart.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      }),
    enabled: authenticated,
  });
  const correiosOptions = (quote.data?.options ?? []).flatMap((o) =>
    o.method === "correios" ? [o] : [],
  );
  const selectedOption =
    correiosOptions.find((o) => o.service === shippingService) ??
    correiosOptions[0] ??
    null;
  const pickupOption = quote.data?.options.find((o) => o.method === "pickup");
  const motoboyOption = quote.data?.options.find((o) => o.method === "motoboy") ?? null;
  const motoboyNote = quote.data?.motoboyNote ?? null;

  // Se o CEP mudar e o motoboy deixar de atender, volta para os Correios.
  useEffect(() => {
    if (delivery === "motoboy" && quote.data && !motoboyOption) setDelivery("sedex");
  }, [delivery, quote.data, motoboyOption]);

  const items = cart.lines.map((line) => ({
    line,
    product: catalog.data?.products.find((p) => p.id === line.productId) ?? null,
  }));
  const subtotal = items.reduce(
    (sum, i) => sum + (i.product?.priceCents ?? 0) * i.line.quantity,
    0,
  );
  const shipping =
    delivery === "pickup"
      ? 0
      : delivery === "motoboy"
        ? (motoboyOption?.priceCents ?? null)
        : selectedOption
          ? selectedOption.priceCents
          : null;
  // 5% off on Pix, except promotional products (the server applies the same rule)
  const pixDiscount = items.reduce(
          (sum, i) =>
            sum +
            (i.product
              ? pixDiscountForLine(
                  i.product.priceCents ?? 0,
                  i.line.quantity,
                  isPromotion(i.product),
                )
              : 0),
    0,
  );
  // The total shown is the card price; the Pix discount is applied on the InfinitePay page.
  const total = shipping === null ? null : subtotal + shipping;
  const totalNoPix = total === null ? null : total - pixDiscount;

  if (authState.type === "loading") {
    return <AuthLoadingState title="Carregando" />;
  }
  if (authState.type === "unauthenticated") {
    return <Navigate to="/login?next=/checkout" replace />;
  }

  if (cart.lines.length === 0 && !submitting) {
    return (
      <ShopLayout title="Finalizar compra">
        <p>Seu carrinho está vazio.</p>
        <Button asChild>
          <Link to="/#categorias">Ver produtos</Link>
        </Button>
      </ShopLayout>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (catalog.isFetching && !catalog.data) return;
    if (items.some((i) => !i.product || i.product.priceCents === null)) {
      toast.error("Há produtos indisponíveis no carrinho. Remova-os para continuar.");
      return;
    }
    if (name.trim().length < 3) return toast.error("Informe seu nome completo.");
    if (!isValidCpf(cpf)) return toast.error("CPF inválido.");
    if (![10, 11].includes(digits(phone).length))
      return toast.error("Informe o telefone com DDD.");
    if (delivery !== "pickup") {
      if (cepDigits.length !== 8) return toast.error("Informe o CEP de entrega.");
      if (
        !street.trim() ||
        !streetNumber.trim() ||
        !neighborhood.trim() ||
        !city.trim() ||
        state.trim().length !== 2
      )
        return toast.error("Complete o endereço de entrega.");
      if (delivery === "sedex" && !selectedOption)
        return toast.error("Não foi possível calcular o frete.");
      if (delivery === "motoboy" && !motoboyOption)
        return toast.error("O motoboy não atende esse endereço. Escolha outra entrega.");
    }
    if (delivery === "pickup" && !pickupAgree)
      return toast.error("Confirme que vai agendar a retirada pelo WhatsApp.");

    setSubmitting(true);
    try {
      const result = await postOrderCreate({
        items: cart.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
        customer: { name, cpf, phone },
        deliveryMethod: delivery,
        shippingService: delivery === "sedex" ? (selectedOption?.service ?? null) : null,
        address:
          delivery !== "pickup"
            ? {
                cep,
                street,
                number: streetNumber,
                complement,
                neighborhood,
                city,
                state,
              }
            : null,
      });
      cart.clear();
      // Pix ou cartão: o cliente paga na página segura da InfinitePay e volta para o pedido.
      window.location.assign(result.paymentUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível finalizar o pedido.",
      );
      setSubmitting(false);
    }
  };

  return (
    <ShopLayout title="Finalizar compra" wide>
      <form onSubmit={submit} className={styles.grid}>
        <div className={styles.left}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>1. Seus dados</h2>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span>Nome completo</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className={styles.field}>
                <span>CPF</span>
                <Input value={cpf} inputMode="numeric" placeholder="000.000.000-00" onChange={(e) => setCpf(maskCpf(e.target.value))} />
              </label>
              <label className={styles.field}>
                <span>Celular (com DDD)</span>
                <Input value={phone} inputMode="tel" placeholder="(11) 99999-9999" autoComplete="tel" onChange={(e) => setPhone(maskPhone(e.target.value))} />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>2. Entrega</h2>
            <div className={styles.options}>
              {correiosOptions.length === 0 ? (
                <button
                  type="button"
                  className={styles.option}
                  data-selected={delivery === "sedex"}
                  onClick={() => setDelivery("sedex")}
                >
                  <Truck size={20} />
                  <span className={styles.optionText}>
                    <strong>Envio pelos Correios</strong>
                    <small>Informe o CEP para ver o valor</small>
                  </span>
                </button>
              ) : (
                correiosOptions.map((o) => (
                  <button
                    key={o.service}
                    type="button"
                    className={styles.option}
                    data-selected={
                      delivery === "sedex" && selectedOption?.service === o.service
                    }
                    onClick={() => {
                      setDelivery("sedex");
                      setShippingService(o.service);
                    }}
                  >
                    <Truck size={20} />
                    <span className={styles.optionText}>
                      <strong>{o.service === "sedex" ? "SEDEX" : "PAC"} (Correios)</strong>
                      <small>
                        {o.originalPriceCents !== undefined ? (
                          <>
                            <s>{formatCents(o.originalPriceCents)}</s>{" "}
                            {o.priceCents === 0
                              ? "Frete grátis"
                              : `${formatCents(o.priceCents)} (a loja paga ${formatCents(o.originalPriceCents - o.priceCents)})`}
                          </>
                        ) : (
                          formatCents(o.priceCents)
                        )}
                        {o.days > 0 ? ` · até ${o.days} dias úteis` : ""}
                        {o.estimated ? " · valor estimado" : ""}
                      </small>
                    </span>
                  </button>
                ))
              )}
              {motoboyOption ? (
                <button
                  type="button"
                  className={styles.option}
                  data-selected={delivery === "motoboy"}
                  onClick={() => setDelivery("motoboy")}
                >
                  <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
                    🏍️
                  </span>
                  <span className={styles.optionText}>
                    <strong>Entrega Expressa via Motoboy (Receba em até 24h)</strong>
                    <small>
                      {formatCents(motoboyOption.priceCents)} · {motoboyOption.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km da loja
                    </small>
                  </span>
                </button>
              ) : null}
              {pickupOption ? (
                <button
                  type="button"
                  className={styles.option}
                  data-selected={delivery === "pickup"}
                  onClick={() => setDelivery("pickup")}
                >
                  <Store size={20} />
                  <span className={styles.optionText}>
                    <strong>Retirar em ponto de retirada</strong>
                    <small>Grátis · Porto Alegre · agendar após a compra</small>
                  </span>
                </button>
              ) : null}
            </div>

            {motoboyNote ? <p className={styles.note}>{motoboyNote}</p> : null}

            {delivery === "pickup" && pickupOption ? (
              <div className={styles.note}>
                <p className={styles.pickupText}>
                  {pickupOption.address ? <strong>{pickupOption.address}. </strong> : null}
                  {pickupOption.note}
                </p>
                <label className={styles.pickupAgree}>
                  <input
                    type="checkbox"
                    checked={pickupAgree}
                    onChange={(e) => setPickupAgree(e.target.checked)}
                  />
                  <span>
                    Entendi que preciso <strong>agendar a retirada pelo WhatsApp</strong>{" "}
                    depois da compra. O pedido só é entregue com horário marcado.
                  </span>
                </label>
              </div>
            ) : (
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span>CEP</span>
                  <Input value={cep} inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" onChange={(e) => setCep(maskCep(e.target.value))} />
                </label>
                <label className={`${styles.field} ${styles.span2}`}>
                  <span>Rua</span>
                  <Input value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="address-line1" />
                </label>
                <label className={styles.field}>
                  <span>Número</span>
                  <Input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Complemento</span>
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Bairro</span>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Cidade</span>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Estado (UF)</span>
                  <Input value={state} maxLength={2} onChange={(e) => setState(e.target.value.toUpperCase())} />
                </label>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>3. Pagamento</h2>
            <div className={styles.options}>
              <div className={styles.option} data-selected="true">
                <QrCode size={20} />
                <span className={styles.optionText}>
                  <strong>Pix</strong>
                  <small>Aprovação na hora · 5% de desconto</small>
                </span>
              </div>
              <div className={styles.option} data-selected="true">
                <CreditCard size={20} />
                <span className={styles.optionText}>
                  <strong>Cartão de crédito</strong>
                  <small>Parcele em até 3x</small>
                </span>
              </div>
            </div>
            <p className={styles.note}>
              Ao finalizar, você vai para a página segura da InfinitePay e escolhe lá
              se paga no Pix (com 5% de desconto, menos nos produtos em promoção) ou
              no cartão.
            </p>
            <AvisoPagamento />
          </section>
        </div>

        <aside className={styles.summary}>
          <h2 className={styles.cardTitle}>Resumo</h2>
          <ul className={styles.items}>
            {items.map(({ line, product }) => (
              <li key={line.productId}>
                <span>
                  {line.quantity}× {product?.name ?? "Produto"}
                </span>
                <span>
                  {product?.priceCents != null
                    ? formatCents(product.priceCents * line.quantity)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.line}>
            <span>Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <div className={styles.line}>
            <span>Frete</span>
            <span>
              {shipping === null
                ? "Informe o CEP"
                : shipping === 0
                  ? "Grátis"
                  : formatCents(shipping)}
            </span>
          </div>
          <div className={`${styles.line} ${styles.total}`}>
            <span>Total</span>
            <span>{total === null ? "—" : formatCents(total)}</span>
          </div>
          {pixDiscount > 0 && totalNoPix !== null ? (
            <div className={styles.line}>
              <span>No Pix (−{formatCents(pixDiscount)})</span>
              <span>{formatCents(totalNoPix)}</span>
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className={styles.submit}
            disabled={submitting || total === null}
          >
            {submitting ? (
              <>
                <Spinner size="sm" /> Processando...
              </>
            ) : (
              "Ir para o pagamento"
            )}
          </Button>
          <p className={styles.secure}>
            Pagamento processado com segurança pela InfinitePay. Os dados do
            cartão não passam pelo nosso servidor.
          </p>
          <Link to="/carrinho" className={styles.back}>
            Voltar ao carrinho
          </Link>
        </aside>
      </form>
    </ShopLayout>
  );
}
