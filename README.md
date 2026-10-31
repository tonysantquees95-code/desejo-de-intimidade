# Desejo de Intimidade — App

App para celular (Android e iOS) da loja **Desejo de Intimidade**, sex shop com entrega discreta.

- Loja online: https://desejo-de-intimidade.floot.app
- Site feito no [Floot](https://floot.com)
- App feito com [Capacitor](https://capacitorjs.com), que abre a loja dentro de um app instalável

## Como funciona

O app abre a loja online em tela cheia, com ícone próprio e tela de abertura. Tudo que muda no site
(produtos, preços, páginas) aparece no app na hora, sem precisar publicar uma nova versão nas lojas.

Sem internet, o app mostra uma tela própria (`sem-conexao.html`) com um botão para tentar de novo.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `capacitor.config.json` | Nome do app, endereço da loja, cores da tela de abertura e da barra de status |
| `package.json` | Dependências e comandos |
| `sem-conexao.html` | Tela mostrada quando o celular está sem internet |
| `preparar-web.js` | Monta a pasta `www` que o Capacitor exige |

## Gerar o app (precisa de um computador)

Requisitos: [Node.js](https://nodejs.org) 20 ou mais recente; Android Studio (Android); Mac com Xcode (iOS).

```bash
npm install
npm run build
npx cap add android      # só na primeira vez
npx cap add ios          # só na primeira vez, e só no Mac
npm run android          # abre o projeto no Android Studio
npm run ios              # abre o projeto no Xcode
```

### Ícone e tela de abertura

Crie uma pasta `assets` com:

- `icon.png` — 1024×1024, logo da loja
- `splash.png` — 2732×2732, logo centralizado no fundo `#1a0d14`

Depois rode `npm run icones`. As imagens são geradas para Android e iOS automaticamente.

## Antes de publicar nas lojas

- **Regras para produtos adultos:** Google Play e App Store têm políticas restritas para apps com
  conteúdo sexual. Leia as regras atuais de cada loja antes de enviar, configure a classificação
  etária como adulto e evite imagens explícitas nas telas e nos prints de divulgação.
- **Identificador do app:** `com.desejodeintimidade.app` em `capacitor.config.json`. Ele não pode
  ser trocado depois de publicar, então confirme antes.
- **Contas de desenvolvedor:** Google Play Console (taxa única) e Apple Developer Program (anual).

## Próximos passos

- [ ] Trazer o código do site do Floot para este repositório
- [ ] Adicionar ícone e tela de abertura com a identidade visual da loja
- [ ] Ajustar cores do app para combinar com o site
- [ ] Gerar e testar a versão Android
