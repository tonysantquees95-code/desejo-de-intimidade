import type { PagePrefetchFn } from "@floot/prefetch";
import { loadCatalog } from "../helpers/loadCatalog";

// Same key as helpers/useCatalog, so the server-rendered HTML already has the products.
export const prefetch: PagePrefetchFn = async ({ qc }) => {
  await qc.prefetchQuery({ queryKey: ["catalog"], queryFn: () => loadCatalog() });
  return { maxAge: 300 };
};