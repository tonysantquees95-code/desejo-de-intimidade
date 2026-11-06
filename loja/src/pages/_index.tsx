import React, { useRef } from "react";
import { Helmet } from "react-helmet";
import {
  Instagram,
  MessageCircle,
  ShieldCheck,
  Package,
  EyeOff,
  Truck,
  Star,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { SiteHeader } from "../components/SiteHeader";
import { InstalarApp } from "../components/InstalarApp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { useScrollReveal } from "../helpers/useScrollReveal";
import { useCatalog } from "../helpers/useCatalog";
import { useCart } from "../helpers/cart";
import { formatCents } from "../helpers/formatCents";
import { toast } from "../helpers/toast";
import { productCategories } from "../helpers/productCategories";
import { isPromotion } from "../helpers/pricing";
import { PriceBlock } from "../components/PriceBlock";
import { Link } from "react-router-dom";
import { SITE_URL, absoluteUrl } from "../helpers/siteUrl";
import styles from "./_index.module.css";

const INSTAGRAM_HANDLE = "desejodeintimidade";
const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

const buildWhatsappUrl = (number: string, message: string) =>
  number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : "#contato";

const discretion = [
  {
    icon: Package,
    title: "Embalagem neutra",
    text: "Caixa lacrada, sem logo e sem qualquer indicação do conteúdo.",
  },
  {
    icon: EyeOff,
    title: "Remetente discreto",
    text: "Na etiqueta e na nota fiscal, nada que revele o tipo de produto.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidade total",
    text: "Seus dados são usados somente para a entrega e nunca compartilhados.",
  },
  {
    icon: Truck,
    title: "Envio para todo o Brasil",
    text: "Acompanhe o pedido em tempo real e receba com segurança.",
  },
];

const payments = ["Pix", "Visa", "Mastercard", "Elo"];

const faqs = [
  {
    q: "A entrega é discreta?",
    a: "Sim. Enviamos em caixa lacrada, sem logo e sem qualquer indicação do conteúdo, e o remetente na etiqueta não revela o tipo de produto.",
  },
  {
    q: "Quais são as formas de pagamento?",
    a: "Pix, com 5% de desconto nos produtos que não estão em promoção, e cartão de crédito em até 3x, com parcela mínima de R$ 20,00.",
  },
  {
    q: "Como é calculado o frete e o prazo?",
    a: "O frete é calculado pelo seu CEP, na página do produto ou no carrinho, com SEDEX e PAC dos Correios. O valor e o prazo aparecem juntos, antes de você pagar.",
  },
  {
    q: "Como acompanho meu pedido?",
    a: "Na área Minha conta você vê cada etapa do pedido, e o código de rastreio aparece assim que o envio é postado.",
  },
  {
    q: "Preciso ser maior de idade?",
    a: "Sim. A venda é exclusiva para maiores de 18 anos.",
  },
  {
    q: "Posso tirar dúvidas antes de comprar?",
    a: "Pode. Fale com a gente pelo WhatsApp da loja, sem compromisso.",
  },
];

const LOGO_URL = absoluteUrl(
  "/_cdn/static/86d30161-7ae8-424f-a57b-78ebd06a5975-logo-og.jpg",
);
const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Desejo de Intimidade",
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  image: LOGO_URL,
  description:
    "Sex shop online com entrega discreta para todo o Brasil: géis e lubrificantes, vibradores, masturbadores, fantasias e acessórios.",
  areaServed: "BR",
  currenciesAccepted: "BRL",
  paymentAccepted: "Pix, Cartão de crédito",
  sameAs: ["https://instagram.com/desejodeintimidade"],
};
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function IndexPage() {
  const heroRef = useScrollReveal();
  const catRef = useScrollReveal();
  const discRef = useScrollReveal();

  const { data, isFetching, isError } = useCatalog();
  const cart = useCart();
  const reviews = data?.reviews ?? [];
  const promos = (data?.products ?? []).filter((p) => isPromotion(p));
  const promoRef = useRef<HTMLDivElement>(null);
  const scrollPromos = (direction: -1 | 1) =>
    promoRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  const catStripRef = useRef<HTMLDivElement>(null);
  const scrollCats = (direction: -1 | 1) =>
    catStripRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  // Foto de cada categoria: a primeira foto de produto que ela tem.
  const categoryImage = (id: string) =>
    (data?.products ?? []).find((p) => p.category === id && p.imageUrl)?.imageUrl ?? null;
  const whatsappNumber = data?.whatsappNumber ?? "";
  const generalWhatsapp = buildWhatsappUrl(
    whatsappNumber,
    "Olá! Vim pelo site da Desejo de Intimidade.",
  );
  const productWhatsapp = (name: string) =>
    buildWhatsappUrl(
      whatsappNumber,
      `Olá! Vi o produto "${name}" no site da Desejo de Intimidade e quero saber mais.`,
    );

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Desejo de Intimidade | Sex Shop com entrega discreta</title>
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Desejo de Intimidade" />
        <meta property="og:locale" content="pt_BR" />
        <meta
          property="og:title"
          content="Desejo de Intimidade | Sex Shop com entrega discreta"
        />
        <meta
          property="og:description"
          content="Géis e lubrificantes, vibradores, masturbadores, fantasias e acessórios, com entrega 100% discreta para todo o Brasil."
        />
        <meta
          property="og:image"
          content="https://desejo-de-intimidade.tonysantquees95.workers.dev/_cdn/static/86d30161-7ae8-424f-a57b-78ebd06a5975-logo-og.jpg"
        />
        <meta property="og:image:width" content="600" />
        <meta property="og:image:height" content="600" />
        <meta property="og:url" content="https://desejo-de-intimidade.tonysantquees95.workers.dev/" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta name="rating" content="adult" />
        <meta
          name="google-site-verification"
          content="CdmaT_nVfxWqdSZp1Dy4bj0F-1wJysRj-8IuXQ-5MyI"
        />
        <meta
          name="google-site-verification"
          content="0YRahJWfteiqyoL0tujrq-liNmGKWphglPvWklIuuek"
        />
        <script type="application/ld+json">{JSON.stringify(storeJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <meta
          name="description"
          content="Sex shop online: géis e lubrificantes, vibradores, masturbadores, fantasias e acessórios, com entrega 100% discreta para todo o Brasil."
        />
      </Helmet>

      <SiteHeader whatsappUrl={generalWhatsapp} />

      <main id="topo">
        <section className={styles.hero}>
          <div className={`${styles.heroInner} ${styles.reveal}`} ref={heroRef}>
            <div className={styles.heroText}>
              <Badge className={styles.heroBadge}>
                <Sparkles size={14} /> Novos lançamentos
              </Badge>
              <h1 className={styles.heroTitle}>
                Desperte o seu <span className={styles.neon}>desejo</span>
              </h1>
              <p className={styles.heroLead}>
                Vibradores, géis, fantasias e acessórios para apimentar a vida a
                dois ou a sós. Compra segura e entrega 100% discreta.
              </p>
              <div className={styles.heroActions}>
                <Button asChild size="lg" className={styles.glowBtn}>
                  <a href="#categorias">
                    Ver coleção <ArrowRight />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className={styles.outlineBtn}>
                  <a href={generalWhatsapp} target="_blank" rel="noopener noreferrer">
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
            <div className={styles.heroImageWrap}>
              <img
                className={styles.heroImage}
                src="/_cdn/static/5b5c9cb0-4e1a-49a5-8bb9-8e550cd0130c.png"
                alt="Novidades do sex shop Desejo de Intimidade"
              />
            </div>
          </div>
        </section>

        <section className={styles.catStrip} aria-label="Navegue por categoria">
          <div className={styles.container}>
            <div className={styles.promoWrap}>
              <button
                type="button"
                className={styles.promoArrow}
                aria-label="Categorias anteriores"
                onClick={() => scrollCats(-1)}
              >
                <ChevronLeft />
              </button>
              <div className={styles.catTrack} ref={catStripRef}>
                {productCategories.map((c) => {
                  const img = categoryImage(c.id);
                  return (
                    <Link key={c.id} to={`/categoria/${c.slug}`} className={styles.catTile}>
                      <span className={styles.catTileImg}>
                        {img ? <img src={img} alt="" loading="lazy" /> : <Sparkles size={28} />}
                      </span>
                      <span className={styles.catTileLabel}>{c.title}</span>
                    </Link>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.promoArrow}
                aria-label="Próximas categorias"
                onClick={() => scrollCats(1)}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </section>

        {promos.length > 0 ? (
          <section id="promocoes" className={styles.section}>
            <div className={styles.container}>
              <p className={styles.eyebrow}>Preços especiais</p>
              <h2 className={styles.sectionTitle}>Promoções</h2>
              <div className={styles.promoWrap}>
                <button
                  type="button"
                  className={styles.promoArrow}
                  aria-label="Promoções anteriores"
                  onClick={() => scrollPromos(-1)}
                >
                  <ChevronLeft />
                </button>
                <div className={styles.promoTrack} ref={promoRef}>
                  {promos.map((p) => (
                    <div key={p.id} className={styles.promoCard}>
                      <Link
                        to={`/produto/${p.id}`}
                        className={styles.promoImage}
                        aria-label={`Ver ${p.name}`}
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} loading="lazy" />
                        ) : null}
                      </Link>
                      <div className={styles.promoBody}>
                        <h3 className={styles.promoTitle}>
                          <Link to={`/produto/${p.id}`}>{p.name}</Link>
                        </h3>
                        <PriceBlock
                          priceCents={p.priceCents as number}
                          compareAtCents={p.compareAtCents}
                        />
                        <Button
                          size="sm"
                          className={styles.glowBtn}
                          onClick={() => {
                            if (p.soldOut) {
                              toast("Produto esgotado");
                              return;
                            }
                            cart.add(p.id);
                            toast("Adicionado ao carrinho");
                          }}
                        >
                          <ShoppingBag size={16} /> {p.soldOut ? "Esgotado" : "Comprar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.promoArrow}
                  aria-label="Próximas promoções"
                  onClick={() => scrollPromos(1)}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section id="categorias" className={styles.section}>
          <div className={`${styles.container} ${styles.reveal}`} ref={catRef}>
            <p className={styles.eyebrow}>Nossas categorias</p>
            <h2 className={styles.sectionTitle}>Escolha o seu universo</h2>
            <Tabs defaultValue={productCategories[0].id}>
              <TabsList className={styles.tabsList}>
                {productCategories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className={styles.tabsTrigger}>
                    {c.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {productCategories.map((c) => {
                const items = (data?.products ?? []).filter(
                  (p) => p.category === c.id,
                );
                return (
                  <TabsContent key={c.id} value={c.id}>
                    <p className={styles.catText}>
                      {c.text}{" "}
                      <Link to={`/categoria/${c.slug}`} className={styles.catLink}>
                        Ver todos
                      </Link>
                    </p>
                    {isFetching && !data ? (
                      <div className={styles.grid}>
                        {[0, 1, 2].map((i) => (
                          <Skeleton key={i} className={styles.cardSkeleton} />
                        ))}
                      </div>
                    ) : isError ? (
                      <p className={styles.catText}>
                        Não foi possível carregar os produtos agora. Tente novamente em instantes.
                      </p>
                    ) : items.length === 0 ? (
                      <p className={styles.catText}>
                        Novidades chegando em breve nesta categoria.
                      </p>
                    ) : (
                      <div className={styles.grid}>
                        {items.map((p) => (
                          <div key={p.id} className={styles.card}>
                            <Link
                              to={`/produto/${p.id}`}
                              className={styles.cardImageWrap}
                              aria-label={`Ver ${p.name}`}
                            >
                              {p.imageUrl ? (
                                <img
                                  className={styles.cardImage}
                                  src={p.imageUrl}
                                  alt={p.name}
                                  loading="lazy"
                                />
                              ) : null}
                            </Link>
                            <div className={styles.cardBody}>
                              <h3 className={styles.cardTitle}>
                                <Link to={`/produto/${p.id}`} className={styles.cardTitleLink}>
                                  {p.name}
                                </Link>
                              </h3>
                              {p.description ? (
                                <p className={styles.cardText}>{p.description}</p>
                              ) : null}
                              {p.priceCents !== null ? (
                                <PriceBlock
                                  priceCents={p.priceCents}
                                  compareAtCents={p.compareAtCents}
                                />
                              ) : null}
                              <div className={styles.cardActions}>
                                {p.priceCents !== null ? (
                                  <Button
                                    size="sm"
                                    className={styles.glowBtn}
                                    onClick={() => {
                                      if (p.soldOut) {
                              toast("Produto esgotado");
                              return;
                            }
                            cart.add(p.id);
                                      toast("Adicionado ao carrinho");
                                    }}
                                  >
                                    <ShoppingBag size={16} /> {p.soldOut ? "Esgotado" : "Comprar"}
                                  </Button>
                                ) : null}
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className={styles.outlineBtn}
                                >
                                  <a
                                    href={productWhatsapp(p.name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle size={16} /> Dúvidas
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </section>

        <section id="discricao" className={`${styles.section} ${styles.sectionAlt}`}>
          <div className={`${styles.container} ${styles.reveal}`} ref={discRef}>
            <p className={styles.eyebrow}>Sua privacidade em primeiro lugar</p>
            <h2 className={styles.sectionTitle}>Entrega 100% discreta</h2>
            <p className={styles.sectionLead}>
              Cuidamos de cada detalhe para que você receba seu pedido com
              tranquilidade e total sigilo.
            </p>
            <div className={styles.discGrid}>
              {discretion.map((d) => (
                <div key={d.title} className={styles.discItem}>
                  <span className={styles.discIcon}>
                    <d.icon size={24} />
                  </span>
                  <h3 className={styles.discTitle}>{d.title}</h3>
                  <p className={styles.discText}>{d.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {reviews.length > 0 ? (
          <section id="depoimentos" className={styles.section}>
            <div className={styles.container}>
              <p className={styles.eyebrow}>Quem comprou, aprova</p>
              <h2 className={styles.sectionTitle}>Avaliações de clientes</h2>
              <div className={styles.testGrid}>
                {reviews.map((r) => (
                  <figure key={r.id} className={styles.testCard}>
                    <div
                      className={styles.stars}
                      aria-label={`${r.rating} de 5 estrelas`}
                    >
                      {Array.from({ length: r.rating }, (_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <blockquote className={styles.testText}>“{r.comment}”</blockquote>
                    <figcaption className={styles.testAuthor}>
                      <strong>{r.displayName}</strong>
                      <span>
                        {r.kind === "service"
                          ? "Atendimento e entrega"
                          : (r.productName ?? "Compra verificada")}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="perguntas-frequentes" className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Tire suas dúvidas</p>
            <h2 className={styles.sectionTitle}>Perguntas frequentes</h2>
            <div className={styles.faqList}>
              {faqs.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary className={styles.faqQuestion}>{f.q}</summary>
                  <p className={styles.faqAnswer}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
        <section className={styles.instaBand}>
          <div className={styles.instaInner}>
            <Instagram size={40} className={styles.instaIcon} />
            <h2 className={styles.instaTitle}>Siga a Desejo de Intimidade</h2>
            <p className={styles.instaText}>
              Lançamentos, novidades e bastidores no nosso Instagram.
            </p>
            <Button asChild size="lg" className={styles.glowBtn}>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <Instagram /> @{INSTAGRAM_HANDLE}
              </a>
            </Button>
          </div>
        </section>

      <footer id="contato" className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerCol}>
            <span className={styles.logoText}>
              Desejo <em>de</em> Intimidade
            </span>
            <p className={styles.footerText}>
              Sex shop online com elegância, respeito e discrição. Venda
              exclusiva para maiores de 18 anos.
            </p>
          </div>

          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Redes sociais</h4>
            <div className={styles.socials}>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @desejodeintimidade"
                className={styles.instaPill}
              >
                <Instagram size={20} /> @{INSTAGRAM_HANDLE}
              </a>
              <a href={generalWhatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <MessageCircle size={20} />
              </a>
            </div>
          </div>

          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Formas de pagamento</h4>
            <div className={styles.payments}>
              {payments.map((p) => (
                <span key={p} className={styles.payChip}>
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Fale conosco</h4>
            <Button asChild size="lg" className={styles.glowBtn}>
              <a href={generalWhatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Chamar no WhatsApp
              </a>
            </Button>
            <InstalarApp />
          </div>
        </div>
        <div className={styles.copy}>
          © {new Date().getFullYear()} Desejo de Intimidade. Todos os direitos reservados.{" "}
          <a href="/trocas" className={styles.adminLink}>
            Trocas e devoluções
          </a>{" "}
          <a href="/privacidade" className={styles.adminLink}>
            Privacidade
          </a>{" "}
          <a href="/login" className={styles.adminLink}>
            Área da loja
          </a>
        </div>
      </footer>
    </div>
  );
}
