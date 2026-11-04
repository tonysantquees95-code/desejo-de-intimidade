package com.desejodeintimidade.app;

import android.content.Context;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;

/**
 * Ponte chamada pelas páginas da loja (web/contas-ponte.js) para avisar
 * quem está logado. Responde "login" quando a conta escolhida não está mais
 * com a sessão válida, para a página abrir a tela de login.
 */
final class ContasPonte {

    private final Context ctx;

    ContasPonte(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    /** Código de notificações deste celular, para a loja saber para onde enviar avisos. */
    @JavascriptInterface
    public String tokenPush() {
        return Contas.tokenPush(ctx);
    }

    @JavascriptInterface
    public String registrar(String json) {
        try {
            JSONObject u = (json == null || "null".equals(json)) ? null : new JSONObject(json);
            String id = u == null ? "" : u.optString("id", "");
            if (!id.isEmpty()) {
                String cookies = CookieManager.getInstance().getCookie(Contas.LOJA);
                if (cookies == null || cookies.isEmpty()) return "";
                Contas.registrar(ctx, id, u.optString("nome", ""), u.optString("email", ""), cookies);
                Contas.definirPendente(ctx, null);
                return "ok";
            }
            if (Contas.pendente(ctx) != null) {
                Contas.definirPendente(ctx, null);
                return "login";
            }
        } catch (Exception ignorado) {
            // Nunca atrapalhar a navegação na loja.
        }
        return "";
    }
}
