import { apiRequest } from "../../helpers/apiRequest";

export type AdminReview = {
  id: number;
  orderId: number;
  kind: string;
  productName: string | null;
  rating: number;
  comment: string | null;
  displayName: string;
  visible: boolean;
  createdAt: Date;
};

export type OutputType = { reviews: AdminReview[] };

export const getAdminReviews = () =>
  apiRequest<OutputType>("/_api/admin/reviews", { method: "GET" });