import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminProducts } from "../endpoints/admin/products_GET.schema";
import { postProductSave } from "../endpoints/admin/product_save_POST.schema";
import { postProductDelete } from "../endpoints/admin/product_delete_POST.schema";
import { postWhatsapp } from "../endpoints/admin/whatsapp_POST.schema";
import { CATALOG_QUERY_KEY } from "./useCatalog";

const ADMIN_KEY = ["admin", "products"] as const;

export function useAdminCatalog() {
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
  };

  const query = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: () => getAdminProducts(),
  });

  const save = useMutation({
    mutationFn: postProductSave,
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: postProductDelete,
    onSuccess: refresh,
  });

  const saveWhatsapp = useMutation({
    mutationFn: postWhatsapp,
    onSuccess: refresh,
  });

  return { query, save, remove, saveWhatsapp };
}