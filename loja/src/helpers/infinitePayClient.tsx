// Server-only: InfinitePay "Checkout Integrado". Never import from frontend code.
// Docs: https://www.infinitepay.io/checkout-documentacao

const BASE_URL = "https://api.checkout.infinitepay.io";

/** InfiniteTag da loja (sem o $). Não é segredo. */
export function infiniteHandle(): string {
  return (process.env.INFINITEPAY_HANDLE || "desejodeintimidade").replace(/^\$/, "").trim();
}

/** A chave de API só é exigida para as opções do link (desconto no Pix, parcelas absorvidas, validade). */
export function infiniteApiKey(): string | null {
  return process.env.INFINITEPAY_API_KEY?.trim() || null;
}

export class InfinitePayError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, details: unknown) {
    super(`InfinitePay respondeu com erro ${status}`);
    this.status = status;
    this.details = details;
  }
}

export type InfiniteLinkInput = {
  orderNsu: string;
  items: { quantity: number; price: number; description: string }[];
  redirectUrl?: string;
  webhookUrl?: string;
  customer?: { name: string; email: string; phone_number: string };
  address?: Record<string, string>;
  options?: {
    assured_installments?: number;
    single_payment?: boolean;
    valid_until?: string;
    discounts?: { pix?: number };
  };
};

async function post<T>(path: string, body: unknown, apiKey?: string | null): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(apiKey ? { "X-Api-Key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) throw new InfinitePayError(response.status, json);
  return json as T;
}

/** O endereço do link na resposta (o nome do campo pode variar). */
export function linkUrlFrom(resp: unknown): string | null {
  if (!resp || typeof resp !== "object") return null;
  const o = resp as Record<string, unknown>;
  for (const k of ["url", "link", "checkout_url", "payment_url"]) {
    const v = o[k];
    if (typeof v === "string" && v.startsWith("https://")) return v;
  }
  const nested = o.data;
  return nested ? linkUrlFrom(nested) : null;
}

export const infinitePayClient = {
  async createLink(input: InfiniteLinkInput): Promise<string> {
    const apiKey = infiniteApiKey();
    const resp = await post<unknown>(
      "/links",
      {
        handle: infiniteHandle(),
        order_nsu: input.orderNsu,
        items: input.items,
        ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
        ...(input.webhookUrl
          ? { webhook: { url: input.webhookUrl, events: ["paid", "refunded", "canceled"] } }
          : {}),
        ...(input.customer ? { customer: input.customer } : {}),
        ...(input.address ? { address: input.address } : {}),
        ...(apiKey && input.options ? { options: input.options } : {}),
      },
      apiKey,
    );
    const url = linkUrlFrom(resp);
    if (!url) throw new InfinitePayError(502, resp);
    return url;
  },

  /** Confirma um pagamento avisado pelo webhook (o webhook não tem assinatura, então nunca é confiado). */
  paymentCheck(args: { orderNsu: string; transactionNsu: string; slug: string }) {
    return post<{
      success?: boolean;
      paid?: boolean;
      amount?: number;
      paid_amount?: number;
      installments?: number;
      capture_method?: string;
    }>("/payment_check", {
      handle: infiniteHandle(),
      order_nsu: args.orderNsu,
      transaction_nsu: args.transactionNsu,
      slug: args.slug,
    });
  },
};
