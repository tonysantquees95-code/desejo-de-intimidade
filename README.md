# Desejo de Intimidade — App

App para celular (Android e iOS) da loja **Desejo de Intimidade**, sex shop com entrega discreta.

- Loja online: https://desejo-de-intimidade.floot.app
- Site feito no [Floot](https://floot.com)
- App feito com [Capacitor](https://capacitorjs.com), que abre a loja dentro de um app instalável

## Como funciona

1. **Tela de abertura** com o logo da loja.
2. **Confirmação de idade (18+)**, pedida só na primeira vez.
3. **Tela de boas-vindas** (`web/index.html`) com três caminhos: *Entrar na minha conta*,
   *Criar conta* ou *Só quero olhar a loja*. Depois do login a pessoa volta direto para a loja.
4. **Loja online** em tela cheia, dentro do app.

### Contas salvas

Quando a pessoa está logada na loja, o app guarda o nome e a sessão daquela conta (só no celular,
nunca a senha). Na próxima abertura, a tela de boas-vindas mostra **"Olá, Nome!"** e o botão
**Continuar como Nome**. Em **Trocar ou adicionar conta** dá para entrar em outra conta salva com um
toque, adicionar uma nova, remover uma conta do celular ou entrar sem conta. Se a sessão de uma
conta tiver expirado, o app abre a tela de login.

Como funciona: `web/contas-ponte.js` roda nas páginas da loja, consulta `/_api/auth/session` e avisa
o app (`nativo/java/ContasPonte.java`); `ContasPlugin.java` troca a sessão do navegador do app.

### Privacidade (botão no canto da tela de boas-vindas)

- **Ícone discreto:** troca o ícone e o nome na tela inicial por "DI", em fundo grafite.
- **Trava com digital:** pede digital ou senha do celular ao abrir o app (e depois de 2 minutos fora
  dele). Com a trava ligada, o app também some de prints e da lista de apps abertos.

### Notificações

Depois da confirmação de idade, o app convida a pessoa a ativar os avisos (dá para mudar depois em
**Privacidade**). O celular é registrado no Firebase (`nativo/google-services.json`) e o código dele
é enviado à loja por `web/contas-ponte.js` (`POST /_api/app/push_token`), junto da conta logada.
Os avisos usam o canal "Pedidos e promoções", com o conteúdo escondido na tela bloqueada, e um
sino neutro como ícone. Ao tocar no aviso, o app abre a página indicada em `data.url`.

### Aviso de atualização

A tela de boas-vindas consulta `https://desejo-de-intimidade.floot.app/app-versao.json`. Se a
versão publicada ali for maior que a instalada, aparece o botão *Atualizar agora*. Cada build gera
um `app-versao.json` modelo junto com o APK, na página de Releases.

Tudo que muda no site (produtos, preços, páginas) aparece no app na hora, sem gerar nova versão.
Só mudanças no próprio app (ícone, nome, tela de boas-vindas) precisam de um APK novo.

Sem internet, o app mostra uma tela própria (`web/sem-conexao.html`) com um botão para tentar de novo.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `capacitor.config.json` | Nome do app, endereço da loja, cores da tela de abertura e da barra de status |
| `package.json` | Dependências e comandos |
| `web/index.html` | Tela de boas-vindas e confirmação de idade |
| `web/sem-conexao.html` | Tela mostrada quando o celular está sem internet |
| `web/logo.png` | Logo usado na tela de boas-vindas |
| `assets/` | Imagens do ícone e da tela de abertura |
| `preparar-web.js` | Copia a pasta `web` para `www`, que o Capacitor exige |
| `.github/workflows/apk-android.yml` | Gera o APK de teste no GitHub a cada mudança |

## APK

A cada mudança enviada para o GitHub, o APK é gerado sozinho e publicado em
[Releases → teste-android](../../releases/tag/teste-android).

- **Versão oficial** (com o segredo `ASSINATURA_SENHA` cadastrado em *Settings → Secrets and
  variables → Actions*): assinada sempre com a mesma chave, então a atualização instala por cima,
  sem perder login nem carrinho.
- **Versão de teste** (sem o segredo): é preciso desinstalar a anterior antes de instalar.

A chave de assinatura fica criptografada em `nativo/assinatura.p12.enc`. **Guarde a senha em lugar
seguro:** sem ela não dá para gerar atualizações que instalem por cima das versões já distribuídas.

Código nativo do Android (trava, ícone discreto, versão) fica em `nativo/` e é aplicado por
`nativo/aplicar.js` a cada build.

## Gerar o app no computador (opcional)

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

As imagens ficam em `assets/` (logo neon em fundo preto `#000000`). Para trocar, substitua os
arquivos mantendo os nomes e tamanhos e rode `npm run icones`.

## Antes de publicar nas lojas

- **Regras para produtos adultos:** Google Play e App Store têm políticas restritas para apps com
  conteúdo sexual. Leia as regras atuais de cada loja antes de enviar, configure a classificação
  etária como adulto e evite imagens explícitas nas telas e nos prints de divulgação.
- **Identificador do app:** `com.desejodeintimidade.app` em `capacitor.config.json`. Ele não pode
  ser trocado depois de publicar, então confirme antes.
- **Contas de desenvolvedor:** Google Play Console (taxa única) e Apple Developer Program (anual).

## Próximos passos

- [x] Ícone, tela de abertura e cores da loja
- [x] Tela de boas-vindas com login e confirmação de idade
- [x] APK de teste gerado automaticamente
- [x] Versão oficial com assinatura fixa e aviso de atualização
- [x] Ícone discreto e trava com digital
- [ ] Publicar APK e `app-versao.json` no site, com botão "Baixe nosso app"
- [x] Notificações no app (registro do celular)
- [ ] Envio das notificações pelo site (pedido enviado, promoções)
- [ ] Links da loja abrindo direto no app
- [ ] Botão no site para salvar como app no iPhone
