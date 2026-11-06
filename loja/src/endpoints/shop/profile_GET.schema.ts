import { apiRequest } from "../../helpers/apiRequest";

export type OutputType = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
};

export const getProfile = () =>
  apiRequest<OutputType>("/_api/shop/profile", { method: "GET" });