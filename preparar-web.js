// Monta a pasta "www" que o Capacitor exige, a partir da pasta "web".
// web/index.html é a tela de boas-vindas que abre primeiro no app;
// web/sem-conexao.html aparece quando a loja não carrega por falta de internet.
const fs = require("fs");
const path = require("path");

const origem = path.join(__dirname, "web");
const destino = path.join(__dirname, "www");

fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(origem, destino, { recursive: true });

console.log("Pasta www pronta:", fs.readdirSync(destino).join(", "));
