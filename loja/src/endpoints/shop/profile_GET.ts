import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { authErrorResponse } from "../../helpers/requireAdmin";
import type { OutputType } from "./profile_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const profile = await db
      .selectFrom("customerProfiles")
      .selectAll()
      .where("userId", "=", user.id)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        name: user.displayName,
        email: user.email,
        cpf: profile?.cpf ?? "",
        phone: profile?.phone ?? "",
        address: {
          cep: profile?.cep ?? "",
          street: profile?.street ?? "",
          number: profile?.streetNumber ?? "",
          complement: profile?.complement ?? "",
          neighborhood: profile?.neighborhood ?? "",
          city: profile?.city ?? "",
          state: profile?.state ?? "",
        },
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("profile error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível carregar seu cadastro." }),
      { status: 500 },
    );
  }
}