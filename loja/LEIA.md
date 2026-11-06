# Loja Desejo de Intimidade — cópia do Floot

`src/` é a cópia fiel do projeto do Floot (desejo-de-intimidade.floot.app), arquivo por arquivo,
conferida pelo sha256 de cada arquivo. Ficaram de fora só os exemplos do kit (`*.example.*`),
os testes (`*.spec.tsx`) e os arquivos internos do editor (`static/__dev`, menos a lista de dependências
e os princípios de design).

Próximo passo: montar a versão que roda no Cloudflare (Worker + D1) a partir desta cópia,
mantendo as mesmas páginas, o mesmo visual e os mesmos endereços `/_api/...`.
