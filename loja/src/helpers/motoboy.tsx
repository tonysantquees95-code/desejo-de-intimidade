import { db } from "./db";
import type { ShippingConfig } from "./shippingConfigSchema";

/**
 * Entrega Expressa via Motoboy: taxa de saída fixa + valor por km rodado.
 * Roda só no servidor (a cotação é refeita na hora de criar o pedido; o preço do navegador nunca vale).
 *
 * Distância: endereço -> coordenadas (OpenStreetMap/Nominatim) e rota de carro pelo OSRM.
 * Se a rota falhar, usa a distância em linha reta x 1,3. O CEP vira endereço pela BrasilAPI
 * (ou ViaCEP); as coordenadas que a BrasilAPI devolve não servem, são da cidade inteira.
 * As distâncias já calculadas ficam guardadas (site_settings), então o preço mostrado no
 * checkout é sempre o mesmo cobrado no pedido e as APIs gratuitas são pouco usadas.
 */

type Ponto = { lat: number; lng: number };
type Endereco = { rua: string; bairro: string; cidade: string; uf: string };

const USER_AGENT = "DesejoDeIntimidade/1.0 (entrega por motoboy)";

export type MotoboyResult =
  | { ok: true; priceCents: number; km: number }
  | { ok: false; reason: "off" | "sem_origem" | "sem_distancia" | "longe"; km?: number; maxKm: number };

const numero = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

async function buscarJson(url: string, ms = 6000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lerCache(chave: string): Promise<string | null> {
  try {
    const row = await db.selectFrom("siteSettings").select("value").where("key", "=", chave).executeTakeFirst();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function guardarCache(chave: string, valor: string) {
  try {
    await db
      .insertInto("siteSettings")
      .values({ key: chave, value: valor })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: valor }))
      .execute();
  } catch (e) {
    console.error("motoboy: não foi possível guardar o cache", e);
  }
}

// O Nominatim pede no máximo 1 consulta por segundo.
let ultimaConsultaNominatim = 0;
async function nominatim(consulta: string): Promise<Ponto | null> {
  const espera = ultimaConsultaNominatim + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaConsultaNominatim = Date.now();
  const lista = await buscarJson(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
  );
  const primeiro = Array.isArray(lista) ? objeto(lista[0]) : {};
  const lat = numero(primeiro.lat);
  const lng = numero(primeiro.lon);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

/** CEP -> rua, bairro, cidade e UF. */
async function enderecoDoCep(cep: string): Promise<Endereco | null> {
  const brasil = objeto(await buscarJson(`https://brasilapi.com.br/api/cep/v2/${cep}`));
  let e: Endereco = {
    rua: texto(brasil.street),
    bairro: texto(brasil.neighborhood),
    cidade: texto(brasil.city),
    uf: texto(brasil.state),
  };
  if (!e.cidade || !e.uf) {
    const via = objeto(await buscarJson(`https://viacep.com.br/ws/${cep}/json/`));
    e = { rua: texto(via.logradouro), bairro: texto(via.bairro), cidade: texto(via.localidade), uf: texto(via.uf) };
  }
  return e.cidade && e.uf ? e : null;
}

/** Procura as coordenadas do endereço, do mais exato (rua) para o mais geral (bairro). */
async function coordenadas(e: Endereco, numeroDaCasa = ""): Promise<Ponto | null> {
  const fim = `${e.cidade}, ${e.uf}, Brasil`;
  const tentativas: string[] = [];
  if (e.rua) tentativas.push([e.rua + (numeroDaCasa ? `, ${numeroDaCasa}` : ""), e.bairro, fim].filter(Boolean).join(", "));
  if (e.rua && numeroDaCasa) tentativas.push([e.rua, e.bairro, fim].filter(Boolean).join(", "));
  if (e.bairro) tentativas.push(`${e.bairro}, ${fim}`);
  for (const q of tentativas) {
    const ponto = await nominatim(q);
    if (ponto) return ponto;
  }
  return null;
}

function retaKm(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function pontoGuardado(chave: string, buscar: () => Promise<Ponto | null>): Promise<Ponto | null> {
  const guardado = await lerCache(chave);
  if (guardado) {
    try {
      const p = JSON.parse(guardado) as Ponto;
      if (numero(p.lat) !== null && numero(p.lng) !== null) return p;
    } catch {
      /* busca de novo */
    }
  }
  const ponto = await buscar();
  if (ponto) await guardarCache(chave, JSON.stringify(ponto));
  return ponto;
}

async function distanciaKm(sender: ShippingConfig["sender"], destinoCep: string): Promise<number | null> {
  const assinatura = [sender.cep, sender.number, sender.street]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "-");
  const chaveKm = `motoboy_km:${assinatura}:${destinoCep}`;
  const guardado = numero(await lerCache(chaveKm));
  if (guardado !== null) return guardado;

  const origem = await pontoGuardado(`motoboy_geo:origem:${assinatura}`, async () => {
    const doRemetente: Endereco = {
      rua: sender.street,
      bairro: sender.neighborhood,
      cidade: sender.city,
      uf: sender.state,
    };
    const achado = sender.city && sender.state ? await coordenadas(doRemetente, sender.number) : null;
    if (achado) return achado;
    const doCep = await enderecoDoCep(sender.cep.replace(/\D/g, ""));
    return doCep ? coordenadas(doCep) : null;
  });
  if (!origem) return null;

  const destino = await pontoGuardado(`motoboy_geo:cep:${destinoCep}`, async () => {
    const e = await enderecoDoCep(destinoCep);
    return e ? coordenadas(e) : null;
  });
  if (!destino) return null;

  let km: number | null = null;
  const rota = objeto(
    await buscarJson(
      `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=false`,
    ),
  );
  const primeira = Array.isArray(rota.routes) ? objeto(rota.routes[0]) : {};
  const metros = numero(primeira.distance);
  if (metros !== null && metros >= 0) km = metros / 1000;
  if (km === null) km = retaKm(origem, destino) * 1.3;

  km = Math.max(0.1, Math.round(km * 10) / 10);
  await guardarCache(chaveKm, String(km));
  return km;
}

/** Cota o motoboy do endereço de saída da loja (config.sender) até o CEP do cliente. */
export async function quoteMotoboy(config: ShippingConfig, destinoCep: string): Promise<MotoboyResult> {
  const { enabled, baseCents, perKmCents, maxKm } = config.motoboy;
  if (!enabled) return { ok: false, reason: "off", maxKm };
  const origem = config.sender.cep.replace(/\D/g, "");
  const destino = destinoCep.replace(/\D/g, "");
  if (origem.length !== 8) return { ok: false, reason: "sem_origem", maxKm };
  if (destino.length !== 8) return { ok: false, reason: "sem_distancia", maxKm };

  const km = await distanciaKm(config.sender, destino);
  if (km === null) return { ok: false, reason: "sem_distancia", maxKm };
  if (km > maxKm) return { ok: false, reason: "longe", km, maxKm };
  return { ok: true, km, priceCents: baseCents + Math.round(perKmCents * km) };
}
