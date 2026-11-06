import { apiRequest } from "../../helpers/apiRequest";

export type OutputType = { publicKey: string };

export const getCardKey = () =>
  apiRequest<OutputType>("/_api/shop/card_key", { method: "GET" });