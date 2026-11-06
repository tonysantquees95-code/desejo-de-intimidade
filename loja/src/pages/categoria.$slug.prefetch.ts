import type { PagePrefetchFn } from "@floot/prefetch";
import { loadCatalog } from "../helpers/loadCatalog";
import { productCategories } from "../helpers/productCategories";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  await qc.prefetchQuery({ queryKey: ["catalog"], queryFn: () => loadCatalog() });
  const slug = new URL(url, "http://local").pathname.match(/^\/categoria\/([^/]+)\/?$/)?.[1];
  if (!productCategories.some((c) => c.slug === slug)) {
    return { statusCode: 404, maxAge: 60 };
  }
  return { maxAge: 300 };
};