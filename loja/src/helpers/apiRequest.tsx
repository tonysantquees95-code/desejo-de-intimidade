import superjson from "superjson";

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    let message = "Algo deu errado. Tente novamente.";
    try {
      const body = superjson.parse<{ error?: string }>(text);
      if (body?.error) message = body.error;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  return superjson.parse<T>(text);
}

/** Typed GET against one of the app's own endpoints (superjson in/out). */
export async function apiRequest<T>(
  url: string,
  options: { method: "GET" } | { method: "POST"; body: unknown },
): Promise<T> {
  if (options.method === "GET") {
    return parse<T>(await fetch(url, { method: "GET" }));
  }
  return parse<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: superjson.stringify(options.body),
    }),
  );
}
