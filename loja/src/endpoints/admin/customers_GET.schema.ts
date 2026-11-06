import { apiRequest } from "../../helpers/apiRequest";

export type AdminCustomer = {
  id: number;
  displayName: string;
  email: string;
  phone: string | null;
  createdAt: Date | null;
};

export type OutputType = { customers: AdminCustomer[] };

export const getAdminCustomers = () =>
  apiRequest<OutputType>("/_api/admin/customers", { method: "GET" });