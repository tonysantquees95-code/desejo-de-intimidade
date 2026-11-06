import superjson from "superjson";
import { Selectable } from "kysely";
import { Products } from "../../helpers/schema";

export type OutputType = {
  products: Selectable<Products>[];
  whatsappNumber: string;
};

export const getAdminProducts = async (
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/products`, {
    method: "GET",
    ...init,
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};