package com.desejodeintimidade.app;

import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Tempo fora do app que dispensa nova digital (ex.: pagar o Pix no app do banco e voltar). */
    private static final long TOLERANCIA_MS = 2 * 60 * 1000;

    private BiometricPrompt prompt;
    private FrameLayout capa;
    private boolean desbloqueado = false;
    private boolean pedindo = false;
    private long saiuEm = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrivacidadePlugin.class);
        super.onCreate(savedInstanceState);
        aplicarProtecaoDeTela();

        prompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    pedindo = false;
                    desbloqueado = true;
                    saiuEm = 0;
                    removerCapa();
                }

                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence msg) {
                    // Cancelou ou errou: a capa continua, com "Toque para desbloquear".
                    pedindo = false;
                }
            });
    }

    /** Com a trava ligada, o conteúdo do app não aparece em prints nem na tela de apps recentes. */
    void aplicarProtecaoDeTela() {
        if (Privacidade.travaAtiva(this)) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            removerCapa();
        }
    }

    /** Chamado quando a pessoa liga a trava: ela já está dentro do app, então não pede digital agora. */
    void travaLigadaAgora() {
        desbloqueado = true;
        saiuEm = 0;
        aplicarProtecaoDeTela();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!Privacidade.travaAtiva(this)) {
            removerCapa();
            return;
        }
        if (!Privacidade.travaDisponivel(this)) {
            // A senha do celular foi removida: desliga a trava para ninguém ficar trancado fora.
            Privacidade.definirTrava(this, false);
            aplicarProtecaoDeTela();
            return;
        }
        boolean expirou = saiuEm > 0 && SystemClock.elapsedRealtime() - saiuEm > TOLERANCIA_MS;
        if (!desbloqueado || expirou) {
            desbloqueado = false;
            mostrarCapa();
            if (!pedindo) {
                getWindow().getDecorView().post(this::pedirDesbloqueio);
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (desbloqueado && !pedindo) {
            saiuEm = SystemClock.elapsedRealtime();
        }
    }

    private void pedirDesbloqueio() {
        if (pedindo || desbloqueado || isFinishing()) return;
        pedindo = true;
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Desbloquear")
            .setSubtitle("Use sua digital ou a senha do celular")
            .setAllowedAuthenticators(Privacidade.AUTENTICADORES)
            .build();
        try {
            prompt.authenticate(info);
        } catch (Exception e) {
            pedindo = false;
        }
    }

    private void mostrarCapa() {
        if (capa != null) return;
        capa = new FrameLayout(this);
        capa.setBackgroundColor(Color.BLACK);
        capa.setClickable(true);
        capa.setOnClickListener(v -> pedirDesbloqueio());

        TextView texto = new TextView(this);
        texto.setText("🔒\n\nToque para desbloquear");
        texto.setTextColor(Color.parseColor("#FF2E97"));
        texto.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        texto.setGravity(Gravity.CENTER);
        capa.addView(texto, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        addContentView(capa, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void removerCapa() {
        if (capa == null) return;
        ViewGroup pai = (ViewGroup) capa.getParent();
        if (pai != null) pai.removeView(capa);
        capa = null;
    }
}
