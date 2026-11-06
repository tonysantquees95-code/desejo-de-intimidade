// Server-only: talks to the Melhor Envio API. Never import from frontend code.

export type MeQuoteItem = {
  id: number;
  name?: string;
  price?: string | number | null;
  custom_price?: string | number | null;
  delivery_time?: number | null;
  custom_delivery_time?: number | null;
  error?: string;
};

export type MeOrder = {
  id: string;
  status?: string;
  tracking?: string | null;
};

export class MelhorEnvioError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, details: unknown) {
    super(`Melhor Envio respondeu com erro ${status}`);
    this.status = status;
    this.details = details;
  }
}

export function isMelhorEnvioConfigured(): boolean {
  return Boolean(process.env.MELHORENVIO_TOKEN && process.env.MELHORENVIO_ENV);
}

function baseUrl(): string {
  const env = process.env.MELHORENVIO_ENV?.trim().toLowerCase();
  if (env === "production") return "https://melhorenvio.com.br/api/v2";
  if (env === "sandbox") return "https://sandbox.melhorenvio.com.br/api/v2";
  throw new Error('MELHORENVIO_ENV deve ser "production" ou "sandbox".');
}

function token(): string {
  const value = process.env.MELHORENVIO_TOKEN;
  if (!value) throw new Error("MELHORENVIO_TOKEN não configurado.");
  return value;
}

async function request<T>(
  path: string,
  contactEmail: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown },
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      // Melhor Envio requires a User-Agent with a technical contact e-mail
      "User-Agent": `Desejo de Intimidade (${contactEmail})`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    throw new MelhorEnvioError(response.status, json);
  }
  return json as T;
}

export const melhorEnvioClient = {
  calculate(body: unknown, contactEmail: string) {
    return request<MeQuoteItem[]>("/me/shipment/calculate", contactEmail, {
      method: "POST",
      body,
    });
  },
  createCartItem(body: unknown, contactEmail: string) {
    return request<{ id: string }>("/me/cart", contactEmail, {
      method: "POST",
      body,
    });
  },
  /** Removes an unpaid shipment from the Melhor Envio cart. */
  deleteCartItem(meOrderId: string, contactEmail: string) {
    return request<unknown>(
      `/me/cart/${encodeURIComponent(meOrderId)}`,
      contactEmail,
      { method: "DELETE" },
    );
  },
  getOrder(meOrderId: string, contactEmail: string) {
    return request<MeOrder>(
      `/me/orders/${encodeURIComponent(meOrderId)}`,
      contactEmail,
      { method: "GET" },
    );
  },
  printLabels(meOrderIds: string[], contactEmail: string) {
    return request<{ url: string }>("/me/shipment/print", contactEmail, {
      method: "POST",
      body: { mode: "private", orders: meOrderIds },
    });
  },
};