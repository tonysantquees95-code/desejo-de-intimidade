import React, { useEffect, useRef } from "react";
import styles from "./VenusOrbe.module.css";

export type VenusOrbeEstado = "ocioso" | "pensando" | "falando";

type Props = {
  /** Tamanho do quadro em px CSS. O "líquido" ocupa ~48% dele; anéis e brilho, o resto. */
  tamanho: number;
  estado?: VenusOrbeEstado;
  className?: string;
};

const PONTOS = 72;
// Cores: alternam devagar entre lilás, magenta e rosa (nunca chegam ao laranja nem ao amarelo).
const MATIZ = 305;
const OSCILACAO = 32;
const DESLOC_COR2 = 18;
const DESLOC_COR3 = 28;

type Rgb = [number, number, number];

function hsv(h: number, s: number, v: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const clarear = ([r, g, b]: Rgb, q: number): Rgb => [r + (255 - r) * q, g + (255 - g) * q, b + (255 - b) * q];
const rgba = ([r, g, b]: Rgb, a: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, a))})`;

/**
 * O orbe da Vênus, igual ao do app: três camadas de "líquido" que se deformam,
 * brilho, anéis girando, partículas em órbita e cores que alternam devagar
 * entre rosa, magenta e lilás.
 */
export const VenusOrbe = ({ tamanho, estado = "ocioso", className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estadoRef = useRef<VenusOrbeEstado>(estado);
  estadoRef.current = estado;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(tamanho * dpr);
    canvas.height = Math.round(tamanho * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Escala dos traços e partículas: no app o orbe é bem maior, então há um mínimo para não sumirem.
    const k = Math.max(0.55, tamanho / 200);
    const particulas = Array.from({ length: 40 }, () => [
      Math.random() * Math.PI * 2,
      1.25 + Math.random() * 0.75,
      0.15 + Math.random() * 0.6,
      0.8 + Math.random() * 1.8,
      Math.random() * 6.28,
    ]);
    const pontos = new Float32Array(PONTOS * 2);
    // Com "movimento reduzido" ligado no aparelho (ex.: animações desligadas no Windows) o orbe
    // continua vivo, só que bem mais devagar, em vez de ficar parado.
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const ritmo = reduzido ? 0.3 : 1;

    let tempo = Math.random() * 40;
    let giro = 0;
    let energia = 0;
    let ultimo = 0;

    const arco = (cx: number, cy: number, r: number, rotacao: number, partes: number[]) => {
      for (let i = 0; i + 1 < partes.length; i += 2) {
        const ini = ((partes[i] + rotacao) * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(cx, cy, r, ini, ini + (partes[i + 1] * Math.PI) / 180);
        ctx.stroke();
      }
    };

    const forma = (cx: number, cy: number, r: number, desloc: number) => {
      const amp = 0.035 + energia * 0.22;
      for (let j = 0; j < PONTOS; j++) {
        const t = (j / PONTOS) * Math.PI * 2;
        const onda =
          Math.sin(3 * t + tempo * 1.3 + desloc) * 0.5 +
          Math.sin(5 * t - tempo * 1.7 + desloc * 1.3) * 0.3 +
          Math.sin(2 * t + tempo * 0.7 + desloc * 0.7) * 0.4;
        const rr = r * (1 + onda * amp);
        pontos[j * 2] = cx + Math.cos(t) * rr;
        pontos[j * 2 + 1] = cy + Math.sin(t) * rr;
      }
      const u = PONTOS - 1;
      ctx.beginPath();
      ctx.moveTo((pontos[u * 2] + pontos[0]) / 2, (pontos[u * 2 + 1] + pontos[1]) / 2);
      for (let j = 0; j < PONTOS; j++) {
        const p = (j + 1) % PONTOS;
        ctx.quadraticCurveTo(
          pontos[j * 2],
          pontos[j * 2 + 1],
          (pontos[j * 2] + pontos[p * 2]) / 2,
          (pontos[j * 2 + 1] + pontos[p * 2 + 1]) / 2,
        );
      }
      ctx.closePath();
    };

    const desenhar = (agora: number) => {
      const dt = ultimo === 0 ? 0.016 : Math.min(0.05, Math.max(0, (agora - ultimo) / 1000));
      ultimo = agora;
      tempo += dt;

      const est = estadoRef.current;
      const alvo =
        est === "pensando"
          ? 0.3 + 0.12 * Math.sin(tempo * 5)
          : est === "falando"
            ? 0.25 + 0.5 * Math.abs(Math.sin(tempo * 7.3) * Math.sin(tempo * 2.9 + 1)) + 0.08 * Math.sin(tempo * 17)
            : 0.07 + 0.04 * Math.sin(tempo * 1.1);
      energia += (alvo - energia) * Math.min(1, dt * 9);
      giro += dt * (est === "pensando" ? 1.6 : est === "falando" ? 0.7 : 0.22);

      const matiz = MATIZ + OSCILACAO * Math.sin(tempo * 0.13);
      const cor1 = hsv(matiz, 0.78, 1);
      const cor2 = hsv(matiz + DESLOC_COR2, 0.78, 1);
      const cor3 = hsv(matiz + DESLOC_COR3, 0.7, 1);

      const cx = tamanho / 2;
      const cy = tamanho / 2;
      const raio = tamanho * 0.24 * (1 + energia * 0.16);

      ctx.clearRect(0, 0, tamanho, tamanho);
      ctx.globalCompositeOperation = "source-over";

      // brilho de fundo
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio * 2.4);
      g.addColorStop(0, rgba(cor1, 0.3 + 0.25 * energia));
      g.addColorStop(0.45, rgba(cor2, 0.12));
      g.addColorStop(1, rgba(cor2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, raio * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // partículas orbitando
      for (const p of particulas) {
        const ang = p[0] + giro * p[2];
        const dist = raio * p[1] * (1 + 0.08 * Math.sin(tempo * p[2] * 2 + p[4]));
        const brilho = (0.25 + 0.55 * energia) * (0.5 + 0.5 * Math.sin(tempo * 1.7 + p[4]));
        ctx.fillStyle = rgba(p[4] > 3.14 ? cor2 : cor3, brilho);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, Math.max(0.5, p[3] * k), 0, Math.PI * 2);
        ctx.fill();
      }

      // anéis girando
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.strokeStyle = rgba(cor1, 0.35 + 0.25 * energia);
      arco(cx, cy, raio * 1.42, giro * 40, [10, 70, 140, 25, 200, 95]);

      ctx.lineWidth = Math.max(0.8, 1 * k);
      ctx.strokeStyle = rgba(cor2, 0.25 + 0.2 * energia);
      const tracos: number[] = [];
      for (let i = 0; i < 12; i++) tracos.push(i * 30, 10);
      arco(cx, cy, raio * 1.62, -giro * 25, tracos);

      ctx.strokeStyle = rgba(cor3, 0.12 + 0.1 * energia);
      ctx.beginPath();
      ctx.arc(cx, cy, raio * 1.28, 0, Math.PI * 2);
      ctx.stroke();

      // três camadas de "líquido"
      ctx.globalCompositeOperation = "screen";
      const cores = [cor1, cor2, cor3];
      for (let c = 0; c < 3; c++) {
        const desloc = c * 2.1;
        forma(cx, cy, raio * (0.92 + c * 0.05), desloc);
        const fx = cx + Math.cos(giro + desloc) * raio * 0.3;
        const fy = cy + Math.sin(giro + desloc) * raio * 0.3;
        g = ctx.createRadialGradient(fx, fy, 0, fx, fy, raio * 1.35);
        g.addColorStop(0, rgba(clarear(cores[c], 0.3), 0.5));
        g.addColorStop(0.55, rgba(cores[c], 0.62));
        g.addColorStop(1, rgba(cores[c], 0.06));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // núcleo luminoso
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio * 0.8);
      g.addColorStop(0, rgba(clarear(cor2, 0.55), 0.1 + 0.3 * energia));
      g.addColorStop(0.5, rgba(cor2, 0.08));
      g.addColorStop(1, rgba(cor2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, raio * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // reflexo de vidro no alto, à esquerda
      const bx = cx - raio * 0.38;
      const by = cy - raio * 0.42;
      g = ctx.createRadialGradient(bx, by, 0, bx, by, raio * 0.42);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, raio * 0.42, 0, Math.PI * 2);
      ctx.fill();
    };

    let pedido = 0;
    const laco = (agora: number) => {
      desenhar(agora);
      pedido = requestAnimationFrame(laco);
    };

    if (reduzido) {
      // Movimento reduzido: desenha só o orbe parado, sem animar.
      desenhar(performance.now());
    } else {
      pedido = requestAnimationFrame(laco);
    }
    return () => cancelAnimationFrame(pedido);
  }, [tamanho]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.orbe} ${className ?? ""}`}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden="true"
    />
  );
};
