// Prepara o build: lista os endpoints para o Worker (worker/rotas.gen.ts) e copia os arquivos
// estáticos do site (src/static, menos __dev) para publico/, que o Vite copia para dist/.
import { readdirSync, statSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const pasta = join(raiz, "src/endpoints");

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : [p];
  });
}

const rotas = arquivos(pasta)
  .filter((p) => /_(GET|POST)\.ts$/.test(p))
  .map((p) => {
    const rel = relative(pasta, p).replace(/\\/g, "/");
    const m = rel.match(/^(.*)_(GET|POST)\.ts$/);
    return { metodo: m[2], caminho: m[1], importar: "../src/endpoints/" + rel.replace(/\.ts$/, "") };
  })
  .sort((a, b) => (a.caminho + a.metodo).localeCompare(b.caminho + b.metodo));

const linhas = [
  "// Gerado por scripts/preparar.mjs — não editar à mão.",
  ...rotas.map((r, i) => `import * as e${i} from ${JSON.stringify(r.importar)};`),
  "",
  "export const rotas: Record<string, { handle: (r: Request) => Promise<Response> | Response }> = {",
  ...rotas.map((r, i) => `  ${JSON.stringify(r.metodo + " " + r.caminho)}: e${i} as never,`),
  "};",
  "",
];
writeFileSync(join(raiz, "worker/rotas.gen.ts"), linhas.join("\n"));
console.log(`${rotas.length} endpoints`);

const estaticos = join(raiz, "src/static");
const publico = join(raiz, "publico");
let n = 0;
for (const p of arquivos(estaticos)) {
  const rel = relative(estaticos, p);
  if (rel.startsWith("__dev")) continue;
  const destino = join(publico, rel);
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(p, destino);
  n++;
}
console.log(`${n} arquivos estáticos; imagens em publico/_cdn: ${existsSync(join(publico, "_cdn")) ? "sim" : "NÃO (rode o importar)"}`);
