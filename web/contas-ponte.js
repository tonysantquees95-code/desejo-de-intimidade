// Roda dentro das páginas da loja, no app (injetado pela MainActivity).
// Pergunta à loja quem está logado e avisa o app, para a tela de boas-vindas
// mostrar o nome e oferecer "Continuar como". Não lê nem envia senha.
(function () {
  if (window.__desejoContas || !window.DesejoContas) return;
  window.__desejoContas = true;

  var SESSAO = "/_api/auth/session";
  var espera = null;

  // Procura o usuário na resposta, aceitando formatos comuns
  // ({ user: {...} }, { json: { user: {...} } }, ou o próprio usuário).
  function acharUsuario(obj, nivel) {
    if (!obj || typeof obj !== "object" || nivel > 4) return null;
    var temId = obj.id !== undefined && obj.id !== null;
    var temNome = typeof obj.displayName === "string" || typeof obj.name === "string";
    if (typeof obj.email === "string" || (temId && temNome)) return obj;
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        var achado = acharUsuario(obj[k], nivel + 1);
        if (achado) return achado;
      }
    }
    return null;
  }

  function verificar() {
    clearTimeout(espera);
    espera = setTimeout(function () {
      fetch(SESSAO, { credentials: "include", cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (dados) {
          var u = acharUsuario(dados, 0);
          var info = null;
          if (u) {
            var email = typeof u.email === "string" ? u.email : "";
            info = {
              id: email || "id:" + u.id,
              email: email,
              nome: u.displayName || u.name || u.fullName || u.firstName || "",
            };
          }
          var acao = window.DesejoContas.registrar(JSON.stringify(info));
          if (acao === "login" && location.pathname !== "/login") {
            location.replace("/login?next=%2F");
          }
        })
        .catch(function () {});
    }, 500);
  }

  // A loja troca de página sem recarregar (por exemplo, logo depois do login).
  ["pushState", "replaceState"].forEach(function (m) {
    var original = history[m];
    history[m] = function () {
      var r = original.apply(this, arguments);
      verificar();
      return r;
    };
  });
  window.addEventListener("popstate", verificar);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") verificar();
  });

  verificar();
})();
