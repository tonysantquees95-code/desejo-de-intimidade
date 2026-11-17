/**
 * Entrada do site no navegador: monta as mesmas rotas do Floot a partir de src/pages
 * (nome do arquivo → endereço: "_index" = "/", "." = "/", "$id" = ":id") e aplica os pageLayout.
 */
import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "../src/base.css";
import { GlobalContextProviders } from "../src/components/_globalContextProviders";
import { RodapeVetorial } from "../src/components/RodapeVetorial";

type Layout = React.ComponentType<{ children: React.ReactNode }>;

const paginas = import.meta.glob<{ default: React.ComponentType }>(["../src/pages/*.tsx", "!../src/pages/*.pageLayout.tsx"]);
const layouts = import.meta.glob<{ default: Layout[] }>("../src/pages/*.pageLayout.tsx", { eager: true });

function endereco(nome: string): string {
  if (nome === "_index") return "/";
  return "/" + nome.split(".").map((p) => (p.startsWith("$") ? ":" + p.slice(1) : p)).join("/");
}

const rotas = Object.entries(paginas).map(([arquivo, carregar]) => {
  const nome = arquivo.replace("../src/pages/", "").replace(/\.tsx$/, "");
  const Pagina = lazy(carregar);
  const envoltorios = layouts[`../src/pages/${nome}.pageLayout.tsx`]?.default ?? [];
  const elemento = envoltorios.reduceRight<React.ReactNode>((filho, L) => <L>{filho}</L>, <Pagina />);
  return { caminho: endereco(nome), elemento };
});

function NaoEncontrada() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--foreground, #fff)", textAlign: "center", padding: 24 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-family-heading)" }}>Página não encontrada</h1>
        <a href="/" style={{ color: "var(--primary, #ff2d95)" }}>Voltar para a loja</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalContextProviders>
        <Suspense fallback={null}>
          <Routes>
            {rotas.map((r) => (
              <Route key={r.caminho} path={r.caminho} element={r.elemento} />
            ))}
            <Route path="*" element={<NaoEncontrada />} />
          </Routes>
        </Suspense>
        <RodapeVetorial />
      </GlobalContextProviders>
    </BrowserRouter>
  </React.StrictMode>,
);
