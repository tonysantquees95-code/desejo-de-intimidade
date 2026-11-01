// Aplica as personalizações nativas no projeto Android gerado pelo Capacitor
// (rodar depois de `npx cap add android` e `npx cap sync android`).
//
// - Código Java: trava com digital, ícone discreto e plugin "Privacidade"
// - Ícone discreto ("DI") e textos em res/
// - AndroidManifest: dois atalhos de ícone (padrão e discreto)
// - build.gradle: biblioteca de biometria e número de versão
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const app = path.join(raiz, "android", "app");
const pacote = path.join(app, "src", "main", "java", "com", "desejodeintimidade", "app");
const res = path.join(app, "src", "main", "res");

function trocar(arquivo, de, para, descricao) {
  const texto = fs.readFileSync(arquivo, "utf8");
  if (!de.test(texto)) throw new Error(`Não encontrei ${descricao} em ${arquivo}`);
  fs.writeFileSync(arquivo, texto.replace(de, para));
}

// 1. Código Java
for (const nome of fs.readdirSync(path.join(__dirname, "java"))) {
  fs.copyFileSync(path.join(__dirname, "java", nome), path.join(pacote, nome));
}

// 2. Recursos (ícone discreto, cor e nome)
fs.cpSync(path.join(__dirname, "res"), res, { recursive: true });

// 3. Manifest: o ícone sai da MainActivity e vai para dois "activity-alias"
const manifest = path.join(app, "src", "main", "AndroidManifest.xml");
trocar(
  manifest,
  /(<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>)\s*<intent-filter>[\s\S]*?android\.intent\.category\.LAUNCHER[\s\S]*?<\/intent-filter>/,
  "$1",
  "o atalho de abertura da MainActivity",
);
const atalho = (nome, ligado, icone, rotulo) => `
        <activity-alias
            android:name=".${nome}"
            android:targetActivity=".MainActivity"
            android:enabled="${ligado}"
            android:exported="true"
            android:icon="@mipmap/${icone}"
            android:roundIcon="@mipmap/${icone}_round"
            android:label="${rotulo}">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`;
trocar(
  manifest,
  /(<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?<\/activity>)/,
  "$1" +
    atalho("IconePadrao", "true", "ic_launcher", "@string/app_name") +
    atalho("IconeDiscreto", "false", "ic_discreto", "@string/nome_discreto"),
  "a MainActivity",
);

// 4. build.gradle: biometria e versão
const gradle = path.join(app, "build.gradle");
trocar(
  gradle,
  /dependencies\s*\{/,
  'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"',
  "o bloco dependencies",
);
const codigo = parseInt(process.env.VERSAO_CODIGO || "1", 10);
trocar(gradle, /versionCode\s+\d+/, `versionCode ${codigo}`, "versionCode");
trocar(gradle, /versionName\s+"[^"]*"/, `versionName "1.0.${codigo}"`, "versionName");

console.log(`Personalizações aplicadas (versão 1.0.${codigo}, código ${codigo}).`);
