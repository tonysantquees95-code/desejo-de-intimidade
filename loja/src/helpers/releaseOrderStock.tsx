import { sql } from "kysely";
import { db } from "./db";

/**
 * Gives the reserved units of an order back to stock (payment failed, Pix
 * expired, order canceled). Safe to call more than once: each item is only
 * released the first time.
 */
export async function releaseOrderStock(orderId: number): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const reserved = await trx
      .updateTable("orderItems")
      .set({ stockReserved: false })
      .where("orderId", "=", orderId)
      .where("stockReserved", "=", true)
      .returning(["productId", "quantity"])
      .execute();
    for (const item of reserved) {
      if (item.productId === null) continue;
      await trx
        .updateTable("products")
        .set({ stockQuantity: sql`stock_quantity + ${item.quantity}` })
        .where("id", "=", item.productId)
        .where("stockQuantity", "is not", null)
        .execute();
    }
  });
}