package com.desejodeintimidade.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Expõe as configurações de privacidade para a tela de boas-vindas (JavaScript). */
@CapacitorPlugin(name = "Privacidade")
public class PrivacidadePlugin extends Plugin {

    private JSObject estadoAtual() {
        JSObject r = new JSObject();
        r.put("travaDisponivel", Privacidade.travaDisponivel(getContext()));
        r.put("trava", Privacidade.travaAtiva(getContext()));
        r.put("iconeDiscreto", Privacidade.iconeDiscreto(getContext()));
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        call.resolve(estadoAtual());
    }

    @PluginMethod
    public void definirTrava(PluginCall call) {
        boolean ativa = Boolean.TRUE.equals(call.getBoolean("ativa", false));
        if (ativa && !Privacidade.travaDisponivel(getContext())) {
            call.reject("Configure uma digital ou senha de bloqueio no celular para usar a trava.");
            return;
        }
        Privacidade.definirTrava(getContext(), ativa);
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) {
                MainActivity activity = (MainActivity) getActivity();
                if (ativa) {
                    activity.travaLigadaAgora();
                } else {
                    activity.aplicarProtecaoDeTela();
                }
            }
            call.resolve(estadoAtual());
        });
    }

    @PluginMethod
    public void definirIconeDiscreto(PluginCall call) {
        boolean discreto = Boolean.TRUE.equals(call.getBoolean("discreto", false));
        try {
            Privacidade.definirIconeDiscreto(getContext(), discreto);
            call.resolve(estadoAtual());
        } catch (Exception e) {
            call.reject("Não foi possível trocar o ícone.", e);
        }
    }
}
