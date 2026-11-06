// Tipos do @floot/prefetch. No Cloudflare as páginas são montadas no navegador; os prefetch não rodam.
export type PagePrefetchFn = (ctx: { qc: unknown; params: Record<string, string>; request: Request }) => Promise<unknown> | unknown;
