import superjson from "superjson";
import type { Insertable } from "kysely";
import { db } from "../../helpers/db";
import type { Reviews } from "../../helpers/schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./review_create_POST.schema";

function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const order = await db
      .selectFrom("orders")
      .select(["id", "userId", "status", "customerName"])
      .where("id", "=", input.orderId)
      .executeTakeFirst();
    if (!order || order.userId !== user.id) {
      return new Response(superjson.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
      });
    }
    if (order.status !== "delivered") {
      return new Response(
        superjson.stringify({
          error: "Você poderá avaliar assim que o pedido for entregue.",
        }),
        { status: 400 },
      );
    }
    const existing = await db
      .selectFrom("reviews")
      .select("id")
      .where("orderId", "=", order.id)
      .executeTakeFirst();
    if (existing) {
      return new Response(
        superjson.stringify({ error: "Este pedido já foi avaliado. Obrigada!" }),
        { status: 400 },
      );
    }

    const items = await db
      .selectFrom("orderItems")
      .select(["productId", "name"])
      .where("orderId", "=", order.id)
      .execute();
    const displayName = publicName(order.customerName);

    const rows: Insertable<Reviews>[] = input.products.flatMap((p) => {
      const item = items.find((i) => i.productId === p.productId);
      if (!item) return [];
      return [
        {
          orderId: order.id,
          userId: user.id,
          kind: "product",
          productId: p.productId,
          productName: item.name,
          rating: p.rating,
          comment: p.comment || null,
          displayName,
        },
      ];
    });
    if (input.service) {
      rows.push({
        orderId: order.id,
        userId: user.id,
        kind: "service",
        productId: null,
        productName: null,
        rating: input.service.rating,
        comment: input.service.comment || null,
        displayName,
      });
    }
    if (rows.length === 0) {
      return new Response(
        superjson.stringify({ error: "Dê pelo menos uma nota." }),
        { status: 400 },
      );
    }
    await db.insertInto("reviews").values(rows).execute();
    return new Response(superjson.stringify({ ok: true } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("review create error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível enviar sua avaliação." }),
      { status: 400 },
    );
  }
}