package com.desejodeintimidade.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.CookieManager;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Contas da loja salvas no celular: nome, e-mail e a sessão (cookies) de cada uma.
 * Fica só no armazenamento privado do app; nunca guarda senha.
 */
final class Contas {

    static final String LOJA = "https://desejo-de-intimidade.floot.app";

    private static final String PREFS = "contas";
    private static final String LISTA = "lista";
    private static final String ULTIMA = "ultima";
    private static final String PENDENTE = "pendente";

    private Contas() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized JSONArray lista(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(LISTA, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void salvarLista(Context ctx, JSONArray lista) {
        prefs(ctx).edit().putString(LISTA, lista.toString()).apply();
    }

    /** Conta usada por último (aparece em "Continuar como"). */
    static String ultima(Context ctx) {
        return prefs(ctx).getString(ULTIMA, null);
    }

    static void definirUltima(Context ctx, String id) {
        if (id == null) prefs(ctx).edit().remove(ULTIMA).apply();
        else prefs(ctx).edit().putString(ULTIMA, id).apply();
    }

    /** Conta que a pessoa escolheu e ainda não foi confirmada pela loja. */
    static String pendente(Context ctx) {
        return prefs(ctx).getString(PENDENTE, null);
    }

    static void definirPendente(Context ctx, String id) {
        if (id == null) prefs(ctx).edit().remove(PENDENTE).apply();
        else prefs(ctx).edit().putString(PENDENTE, id).apply();
    }

    /** Código deste celular para receber notificações (Firebase). Vazio se não ativou. */
    static String tokenPush(Context ctx) {
        return prefs(ctx).getString("tokenPush", "");
    }

    static void definirTokenPush(Context ctx, String token) {
        prefs(ctx).edit().putString("tokenPush", token == null ? "" : token).apply();
    }

    /** Salva (ou atualiza) a conta logada agora, colocando-a no topo da lista. */
    static synchronized void registrar(Context ctx, String id, String nome, String email, String cookies) {
        JSONArray antiga = lista(ctx);
        JSONArray nova = new JSONArray();
        try {
            JSONObject conta = new JSONObject();
            conta.put("id", id);
            conta.put("nome", nome == null ? "" : nome);
            conta.put("email", email == null ? "" : email);
            conta.put("cookies", cookies);
            conta.put("atualizado", System.currentTimeMillis());
            nova.put(conta);
            for (int i = 0; i < antiga.length(); i++) {
                JSONObject c = antiga.optJSONObject(i);
                if (c != null && !id.equals(c.optString("id"))) nova.put(c);
            }
        } catch (JSONException e) {
            return;
        }
        salvarLista(ctx, nova);
        definirUltima(ctx, id);
    }

    static synchronized void remover(Context ctx, String id) {
        JSONArray antiga = lista(ctx);
        JSONArray nova = new JSONArray();
        for (int i = 0; i < antiga.length(); i++) {
            JSONObject c = antiga.optJSONObject(i);
            if (c != null && !id.equals(c.optString("id"))) nova.put(c);
        }
        salvarLista(ctx, nova);
        if (id.equals(ultima(ctx))) definirUltima(ctx, null);
        if (id.equals(pendente(ctx))) definirPendente(ctx, null);
    }

    static synchronized String cookiesDe(Context ctx, String id) {
        JSONArray l = lista(ctx);
        for (int i = 0; i < l.length(); i++) {
            JSONObject c = l.optJSONObject(i);
            if (c != null && id.equals(c.optString("id"))) return c.optString("cookies", null);
        }
        return null;
    }

    /**
     * Troca a sessão do navegador do app: apaga os cookies atuais e, se houver,
     * coloca os da conta escolhida. Precisa rodar na thread principal.
     */
    static void trocarSessao(String cookies, Runnable depois) {
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(ok -> {
            if (cookies != null) {
                for (String par : cookies.split(";")) {
                    String p = par.trim();
                    if (!p.isEmpty() && p.contains("=")) {
                        cm.setCookie(LOJA, p + "; Path=/; Secure; SameSite=Lax; Max-Age=31536000");
                    }
                }
            }
            cm.flush();
            depois.run();
        });
    }
}
