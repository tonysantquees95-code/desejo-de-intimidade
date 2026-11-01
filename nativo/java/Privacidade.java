package com.desejodeintimidade.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import androidx.biometric.BiometricManager;

/** Configurações de privacidade do app: trava com digital e ícone discreto. */
final class Privacidade {

    static final int AUTENTICADORES =
        BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    private static final String PREFS = "privacidade";
    private static final String CHAVE_TRAVA = "trava";
    private static final String ICONE_PADRAO = "com.desejodeintimidade.app.IconePadrao";
    private static final String ICONE_DISCRETO = "com.desejodeintimidade.app.IconeDiscreto";

    private Privacidade() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** O celular tem digital, rosto ou senha de bloqueio configurados? */
    static boolean travaDisponivel(Context ctx) {
        return BiometricManager.from(ctx).canAuthenticate(AUTENTICADORES) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    static boolean travaAtiva(Context ctx) {
        return prefs(ctx).getBoolean(CHAVE_TRAVA, false);
    }

    static void definirTrava(Context ctx, boolean ativa) {
        prefs(ctx).edit().putBoolean(CHAVE_TRAVA, ativa).apply();
    }

    static boolean iconeDiscreto(Context ctx) {
        int estado = ctx.getPackageManager()
            .getComponentEnabledSetting(new ComponentName(ctx, ICONE_DISCRETO));
        return estado == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    static void definirIconeDiscreto(Context ctx, boolean discreto) {
        PackageManager pm = ctx.getPackageManager();
        ComponentName ligar = new ComponentName(ctx, discreto ? ICONE_DISCRETO : ICONE_PADRAO);
        ComponentName desligar = new ComponentName(ctx, discreto ? ICONE_PADRAO : ICONE_DISCRETO);
        // Liga o novo antes de desligar o antigo, para o app nunca ficar sem ícone.
        pm.setComponentEnabledSetting(ligar, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        pm.setComponentEnabledSetting(desligar, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
    }
}
