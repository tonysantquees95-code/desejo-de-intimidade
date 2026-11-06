import type { PagePrefetchFn } from "@floot/prefetch";
import { loadCatalog } from "../helpers/loadCatalog";
import type { OutputType } from "../endpoints/catalog_GET.schema";

export const prefetch: PagePrefetchFn = async ({ qc, url }) => {
  await qc.prefetchQuery({ queryKey: ["catalog"], queryFn: () => loadCatalog() });
  const id = Number(new URL(url, "http://local").pathname.match(/^\/produto\/(\d+)\/?$/)?.[1]);
  const catalog = qc.getQueryData<OutputType>(["catalog"]);
  // A removed or hidden product answers with a real 404 for search engines.
  if (!catalog?.products.some((p) => p.id === id)) {
    return { statusCode: 404, maxAge: 60 };
  }
  return { maxAge: 300 };
};