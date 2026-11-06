// Tira fotos das páginas da loja nova e da antiga (Floot), no tamanho de celular, e anota erros do navegador.
// Uso (no GitHub Actions): node scripts/conferir.mjs <pasta de saída>
import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const saida = process.argv[2] || "conferencia";
mkdirSync(saida, { recursive: true });
const NOVA = "https://desejo-de-intimidade.tonysantquees95.workers.dev";
const ANTIGA = "https://desejo-de-intimidade.floot.app";
const paginas = (process.env.PAGINAS || "/,/categoria/geis-e-lubrificantes,/produto/13,/carrinho,/login,/cadastro,/trocas,/privacidade,/minha-conta,/admin").split(",");
const relatorio = [];

const navegador = await chromium.launch();
for (const [nome, base] of [["nova", NOVA], ["antiga", ANTIGA]]) {
  if (nome === "antiga" && process.env.SO_NOVA === "1") continue;
  const ctx = await navegador.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on("console", (m) => m.type() === "error" && erros.push("console: " + m.text().slice(0, 300)));
  pagina.on("pageerror", (e) => erros.push("pageerror: " + String(e).slice(0, 300)));
  pagina.on("response", (r) => r.status() >= 400 && erros.push(`HTTP ${r.status()} ${r.url().replace(base, "")}`));
  for (const p of paginas) {
    erros.length = 0;
    const arquivo = `${saida}/${nome}${p.replace(/\//g, "_") || "_"}.png`;
    try {
      await pagina.goto(base + p, { waitUntil: "networkidle", timeout: 45000 });
      await pagina.waitForTimeout(1500);
      await pagina.screenshot({ path: arquivo, fullPage: true });
    } catch (e) {
      erros.push("falhou: " + String(e).slice(0, 200));
    }
    relatorio.push(`## ${nome} ${p}\n${erros.length ? erros.map((x) => "- " + x).join("\n") : "- sem erros"}`);
  }
  await ctx.close();
}
await navegador.close();
writeFileSync(`${saida}/relatorio.md`, relatorio.join("\n\n") + "\n");
console.log(relatorio.join("\n\n"));
