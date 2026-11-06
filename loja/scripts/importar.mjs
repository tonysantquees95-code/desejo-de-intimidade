// Copia do Floot as fotos (/_cdn/...), o service worker dos avisos e os dados (produtos, ideias de publicação)
// e monta dados/semente.sql para o primeiro carregamento do banco D1.
// Uso: node scripts/importar.mjs <endereço do JSON de migração>
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SITE = "https://desejo-de-intimidade.floot.app";
const raiz = new URL("..", import.meta.url).pathname;
const fonte = process.argv[2];
if (!fonte) throw new Error("Passe o endereço do JSON de migração.");

const baixar = async (url) => {
  for (let t = 1; t <= 4; t++) {
    const r = await fetch(url);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    console.warn(`  ${r.status} em ${url} (tentativa ${t})`);
    await new Promise((ok) => setTimeout(ok, 1500 * t));
  }
  throw new Error("Não consegui baixar " + url);
};

const manifesto = JSON.parse((await baixar(fonte.startsWith("http") ? fonte : SITE + fonte)).toString("utf8"));
console.log(`${manifesto.files.length} arquivos, ${manifesto.dados.products.length} produtos`);

for (const f of manifesto.files) {
  const destino = join(raiz, "publico", f);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, await baixar(`${SITE}/${f.split("/").map(encodeURIComponent).join("/")}`));
}
writeFileSync(join(raiz, "publico/floot-push-sw.js"), await baixar(`${SITE}/floot-push-sw.js`));

// ---- semente do banco
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  if (v instanceof Object) return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const linhas = ["-- Gerado por scripts/importar.mjs: dados copiados do Floot (só roda com o banco vazio)."];
const inserir = (tabela, linha) => {
  const cols = Object.keys(linha);
  linhas.push(`INSERT INTO ${tabela} (${cols.join(", ")}) VALUES (${cols.map((c) => q(linha[c])).join(", ")});`);
};
for (const p of manifesto.dados.products) inserir("products", p);
for (const i of manifesto.dados.publicacao_ideias) inserir("publicacao_ideias", i);
const cfg = JSON.parse(readFileSync(join(raiz, "dados/config-inicial.json"), "utf8"));
for (const [key, value] of Object.entries(cfg.site_settings)) inserir("site_settings", { key, value });
mkdirSync(join(raiz, "dados"), { recursive: true });
writeFileSync(join(raiz, "dados/semente.sql"), linhas.join("\n") + "\n");
console.log(`semente: ${linhas.length - 1} linhas`);
