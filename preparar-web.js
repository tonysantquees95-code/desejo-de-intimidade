// Monta a pasta "www" que o Capacitor exige.
// O app abre a loja online; estes arquivos só aparecem quando não há conexão.
const fs = require("fs");
const path = require("path");

const destino = path.join(__dirname, "www");
fs.mkdirSync(destino, { recursive: true });

const pagina = path.join(__dirname, "sem-conexao.html");
fs.copyFileSync(pagina, path.join(destino, "sem-conexao.html"));
fs.copyFileSync(pagina, path.join(destino, "index.html"));

console.log("Pasta www pronta.");
