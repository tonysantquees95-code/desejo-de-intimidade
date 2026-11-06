import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff } from "lucide-react";
import { AdminNav } from "../components/AdminNav";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Switch } from "../components/Switch";
import { toast } from "../helpers/toast";
import { getAdminAjustes, type AjusteDTO } from "../endpoints/admin/ajustes_GET.schema";
import { getAdminRobo } from "../endpoints/admin/robo_GET.schema";
import { postAdminRoboLigar } from "../endpoints/admin/robo_ligar_POST.schema";
import styles from "./admin.module.css";
import local from "./admin.registro.module.css";

const AREAS: Record<string, string> = {
  produto: "Produtos",
  estoque: "Estoque",
  pedido: "Pedidos",
  config: "Configurações",
  robo: "Robô",
  avaliacao: "Avaliações",
  story: "Stories",
};

const fuso = { timeZone: "America/Sao_Paulo" } as const;
const hora = (d: Date) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...fuso });
const dia = (d: Date) => new Date(d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", ...fuso });

function copiar(texto: string, aviso: string) {
  navigator.clipboard
    .writeText(texto)
    .then(() => toast(aviso))
    .catch(() => toast.error("Não consegui copiar. Segure o texto para copiar."));
}

/** Robô do WhatsApp/Instagram (chave para o app Vênus Robô) e o registro de tudo o que mudou no site. */
export default function AdminRegistroPage() {
  const queryClient = useQueryClient();
  const [verChave, setVerChave] = useState(false);
  const robo = useQuery({ queryKey: ["admin", "robo"], queryFn: () => getAdminRobo() });
  const ajustes = useQuery({ queryKey: ["admin", "ajustes"], queryFn: () => getAdminAjustes() });
  const ligar = useMutation({
    mutationFn: postAdminRoboLigar,
    onSuccess: (r) => {
      toast(r.ligado ? "Robô ligado" : "Robô desligado");
      queryClient.invalidateQueries({ queryKey: ["admin", "robo"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "ajustes"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const porDia = new Map<string, AjusteDTO[]>();
  for (const a of ajustes.data?.ajustes ?? []) {
    const d = dia(a.quando);
    porDia.set(d, [...(porDia.get(d) ?? []), a]);
  }

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Registro | Desejo de Intimidade</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <AdminNav title="Registro" current="/admin/registro" />
      <main className={styles.main}>
        <section className={local.secao}>
          <h2 className={local.secaoTitulo}>Robô do WhatsApp e Instagram</h2>
          {robo.isLoading ? (
            <Skeleton className={local.skeleton} />
          ) : robo.isError || !robo.data ? (
            <p className={styles.error}>Não foi possível carregar o robô.</p>
          ) : (
            <div className={local.cartao}>
              <label className={local.linha}>
                <span>{robo.data.ligado ? "Ligado: responde as clientes sozinho" : "Desligado: não responde ninguém"}</span>
                <Switch checked={robo.data.ligado} disabled={ligar.isPending} onCheckedChange={(ligado) => ligar.mutate({ ligado })} />
              </label>
              <div className={local.numeros}>
                <div className={local.numero}>
                  <strong>{robo.data.hoje.clientes}</strong>
                  <span>clientes hoje</span>
                </div>
                <div className={local.numero}>
                  <strong>{robo.data.hoje.atendimentos}</strong>
                  <span>respostas hoje</span>
                </div>
                <div className={local.numero}>
                  <strong>{robo.data.esperando.length}</strong>
                  <span>esperando você</span>
                </div>
              </div>
              {robo.data.esperando.length > 0 ? (
                <ul className={local.lista}>
                  {robo.data.esperando.slice(0, 10).map((e, i) => (
                    <li key={i} className={local.item}>
                      <span className={local.hora}>{hora(e.quando)}</span>
                      <div>
                        <p className={local.texto}>“{e.ultimaMensagem}”</p>
                        <div className={local.meta}>{e.canal === "instagram" ? "Instagram" : "WhatsApp"} · o robô fica em silêncio com ela por 12 h</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <span className={local.rotulo}>Chave do robô (cole no app Vênus Robô)</span>
              <div className={local.chave}>
                <code>{verChave ? robo.data.chave : "•".repeat(24)}</code>
                <Button variant="ghost" size="icon-sm" aria-label={verChave ? "Esconder a chave" : "Mostrar a chave"} onClick={() => setVerChave((v) => !v)}>
                  {verChave ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => copiar(robo.data.chave, "Chave copiada")}>
                  <Copy size={16} /> Copiar
                </Button>
              </div>
              <span className={local.rotulo}>Endereço (já vem preenchido no app)</span>
              <div className={local.chave}>
                <code>{robo.data.endereco}</code>
              </div>
            </div>
          )}
        </section>

        <section className={local.secao}>
          <h2 className={local.secaoTitulo}>O que mudou no site</h2>
          {ajustes.isLoading ? (
            <Skeleton className={local.skeleton} />
          ) : ajustes.isError || !ajustes.data ? (
            <p className={styles.error}>Não foi possível carregar o registro.</p>
          ) : ajustes.data.ajustes.length === 0 ? (
            <p className={styles.empty}>Ainda não há ajustes registrados. A partir de agora, toda mudança de produto, estoque, pedido e configuração aparece aqui.</p>
          ) : (
            <>
              <p className={styles.hint}>{ajustes.data.resumoHoje}</p>
              {[...porDia.entries()].map(([d, lista]) => (
                <div key={d}>
                  <h3 className={local.dia}>{d}</h3>
                  <ul className={local.lista}>
                    {lista.map((a) => (
                      <li key={a.id} className={local.item}>
                        <span className={local.hora}>{hora(a.quando)}</span>
                        <div>
                          <p className={`${local.texto} ${a.ok ? "" : local.falha}`}>{a.texto}</p>
                          <div className={local.meta}>
                            <Badge variant="secondary">{AREAS[a.area] ?? a.area}</Badge>
                            <span>{a.origem}</span>
                            {!a.ok ? <span className={local.falha}>falhou</span> : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </section>
      </main>
    </div>
  );
}