import type { ProductCategory } from "./schema";

export const productCategories: {
  id: ProductCategory;
  /** URL part: /categoria/<slug> */
  slug: string;
  title: string;
  text: string;
}[] = [
  {
    id: "geis_lubrificantes",
    slug: "geis-e-lubrificantes",
    title: "Géis e Lubrificantes",
    text: "Lubrificantes à base de água e silicone, géis íntimos, comestíveis e óleos de massagem.",
  },
  {
    id: "excitantes_retardantes",
    slug: "excitantes-e-retardantes",
    title: "Excitantes e Retardantes",
    text: "Afrodisíacos, excitantes e retardantes em gel, spray e cápsulas para mais prazer.",
  },
  {
    id: "vibradores",
    slug: "vibradores",
    title: "Vibradores e Próteses",
    text: "Vibradores, estimuladores de ponto G, bullets e próteses para uso solo ou a dois.",
  },
  {
    id: "masturbadores",
    slug: "masturbadores-masculinos",
    title: "Masturbadores Masculinos",
    text: "Masturbadores, capas e anéis penianos com texturas e tamanhos variados.",
  },
  {
    id: "fantasias_lingerie",
    slug: "fantasias-e-lingerie",
    title: "Fantasias e Lingerie",
    text: "Fantasias, lingeries e conjuntos sensuais para surpreender e se divertir.",
  },
  {
    id: "acessorios_bdsm",
    slug: "acessorios-e-bdsm",
    title: "Acessórios e BDSM",
    text: "Plugs anais, algemas, vendas, plumas e acessórios para apimentar a brincadeira.",
  },
  {
    id: "kits_casais",
    slug: "kits-para-casais",
    title: "Kits para Casais",
    text: "Combinações prontas para presentear ou surpreender a dois, em embalagem discreta.",
  },
];