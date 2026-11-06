import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./customers_GET.schema";

export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const customers = await db
      .selectFrom("users")
      .leftJoin("customerProfiles", "customerProfiles.userId", "users.id")
      .select([
        "users.id",
        "users.displayName",
        "users.email",
        "customerProfiles.phone as phone",
        "users.createdAt",
      ])
      .where("users.role", "=", "user")
      .orderBy("users.id", "desc")
      .limit(500)
      .execute();
    return new Response(superjson.stringify({ customers } satisfies OutputType));
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("admin customers error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar os clientes." }),
      { status: 500 },
    );
  }
}