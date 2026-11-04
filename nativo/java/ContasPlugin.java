package com.desejodeintimidade.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/** Contas salvas, para a tela de boas-vindas (JavaScript). Nunca devolve os cookies. */
@CapacitorPlugin(name = "Contas")
public class ContasPlugin extends Plugin {

    private JSObject resumo() {
        JSArray contas = new JSArray();
        JSONArray l = Contas.lista(getContext());
        for (int i = 0; i < l.length(); i++) {
            JSONObject c = l.optJSONObject(i);
            if (c == null) continue;
            JSObject item = new JSObject();
            item.put("id", c.optString("id"));
            item.put("nome", c.optString("nome"));
            item.put("email", c.optString("email"));
            contas.put(item);
        }
        JSObject r = new JSObject();
        r.put("contas", contas);
        String ultima = Contas.ultima(getContext());
        r.put("ultima", ultima == null ? "" : ultima);
        return r;
    }

    @PluginMethod
    public void listar(PluginCall call) {
        call.resolve(resumo());
    }

    /** Entra numa conta salva: coloca a sessão dela no navegador do app. */
    @PluginMethod
    public void entrar(PluginCall call) {
        String id = call.getString("id");
        String cookies = id == null ? null : Contas.cookiesDe(getContext(), id);
        if (cookies == null) {
            call.reject("Conta não encontrada.");
            return;
        }
        Contas.definirPendente(getContext(), id);
        Contas.definirUltima(getContext(), id);
        getActivity().runOnUiThread(() -> Contas.trocarSessao(cookies, () -> call.resolve()));
    }

    /** Sai da sessão atual (sem apagar as contas salvas), para entrar com outra ou navegar sem conta. */
    @PluginMethod
    public void semSessao(PluginCall call) {
        Contas.definirPendente(getContext(), null);
        getActivity().runOnUiThread(() -> Contas.trocarSessao(null, () -> call.resolve()));
    }

    /** Remove uma conta da lista. Se for a que está em uso, sai dela também. */
    @PluginMethod
    public void remover(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Conta não informada.");
            return;
        }
        boolean emUso = id.equals(Contas.ultima(getContext()));
        Contas.remover(getContext(), id);
        if (emUso) {
            getActivity().runOnUiThread(() -> Contas.trocarSessao(null, () -> call.resolve(resumo())));
        } else {
            call.resolve(resumo());
        }
    }
}
