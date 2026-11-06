import { apiRequest } from "../helpers/apiRequest";

export type ProductReview = {
  id: number;
  rating: number;
  comment: string;
  displayName: string;
  createdAt: Date;
};

export type OutputType = {
  count: number;
  average: number;
  reviews: ProductReview[];
};

export const getProductReviews = (productId: number) =>
  apiRequest<OutputType>(`/_api/product_reviews?productId=${productId}`, {
    method: "GET",
  });