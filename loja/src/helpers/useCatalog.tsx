import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "../endpoints/catalog_GET.schema";

export const CATALOG_QUERY_KEY = ["catalog"] as const;

export function useCatalog() {
  return useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: () => getCatalog(),
  });
}