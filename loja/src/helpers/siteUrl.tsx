/**
 * Public address of the store. Used for canonical links, Open Graph and the
 * sitemap. When a custom domain is connected, change it here (one place).
 */
export const SITE_URL = "https://desejo-de-intimidade.tonysantquees95.workers.dev";

/** "/produto/3" or "/_cdn/..." -> full URL. Absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}