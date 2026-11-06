// Server-only: talks to the Mercado Pago Payments API. Never import from frontend code.

export type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export class MercadoPagoError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, details: unknown) {
    super(`Mercado Pago respondeu com erro ${status}`);
    this.status = status;
    this.details = details;
  }
}

const BASE_URL = "https://api.mercadopago.com";

function accessToken(): string {
  const value = process.env.MP_ACCESS_TOKEN;
  if (!value) {
    throw new Error("MP_ACCESS_TOKEN não configurado.");
  }
  return value;
}

async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.idempotencyKey
        ? { "X-Idempotency-Key": init.idempotencyKey }
        : {}),
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
    throw new MercadoPagoError(response.status, json);
  }
  return json as T;
}

export const mercadoPagoClient = {
  createPayment(body: unknown, idempotencyKey: string) {
    return request<MpPayment>("/v1/payments", {
      method: "POST",
      body,
      idempotencyKey,
    });
  },

  getPayment(paymentId: string) {
    return request<MpPayment>(
      `/v1/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
    );
  },

  /** Full refund of a payment (Pix or card). Safe to repeat with the same key. */
  refundPayment(paymentId: string, idempotencyKey: string) {
    return request<{ id: number; status?: string }>(
      `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      { method: "POST", body: {}, idempotencyKey },
    );
  },
};