import { db } from "./db";
import { shippingConfigSchema, type ShippingConfig } from "./shippingConfigSchema";

/** Reads the delivery prices / pickup settings the owner edits in the admin. */
export async function loadShippingConfig(): Promise<ShippingConfig> {
  const row = await db
    .selectFrom("siteSettings")
    .select("value")
    .where("key", "=", "shipping_config")
    .executeTakeFirst();
  if (!row) {
    throw new Error("Configuração de entrega não encontrada.");
  }
  return shippingConfigSchema.parse(JSON.parse(row.value));
}
