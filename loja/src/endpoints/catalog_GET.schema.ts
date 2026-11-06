import superjson from "superjson";
import { Selectable } from "kysely";
import { Products } from "../helpers/schema";

export type CatalogProduct = Pick<
  Selectable<Products>,
  | "id"
  | "category"
  | "name"
  | "description"
  | "priceCents"
  | "compareAtCents"
  | "specifications"
  | "imageUrl"
> & {
  /** true when the owner tracks stock and no units are left */
  soldOut: boolean;
};

export type CatalogReview = {
  id: number;
  kind: string;
  rating: number;
  comment: string;
  displayName: string;
  productName: string | null;
};

export type OutputType = {
  whatsappNumber: string;
  products: CatalogProduct[];
  reviews: CatalogReview[];
};

export const getCatalog = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/catalog`, {
    method: "GET",
    ...init,
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};