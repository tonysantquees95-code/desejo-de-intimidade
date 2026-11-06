import superjson from "superjson";
import { createHash, randomInt } from "crypto";
import { db } from "../../helpers/db";
import { requireAdmin, authErrorResponse } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./reset_code_POST.schema";

const CODE_TTL_MINUTES = 30;

// Same hash as auth/request_password_reset_POST and auth/reset_password_POST.
function hashResetCode(userId: number, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/**
 * The owner generates a one-time code for a customer who asked on WhatsApp,
 * and sends it by hand. The customer then types it on the "forgot password" page.
 */
export async function handle(request: Request) {
  try {
    await requireAdmin(request);
    const { userId } = schema.parse(superjson.parse(await request.text()));

    const user = await db
      .selectFrom("users")
      .leftJoin("customerProfiles", "customerProfiles.userId", "users.id")
      .select(["users.id", "users.email", "users.displayName", "customerProfiles.phone as phone"])
      .where("users.id", "=", userId)
      .where("users.role", "=", "user")
      .executeTakeFirst();
    if (!user) {
      return new Response(superjson.stringify({ error: "Cliente não encontrada." }), {
        status: 404,
      });
    }

    const now = new Date();
    const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
    await db.transaction().execute(async (trx) => {
      // Only the newest code works.
      await trx
        .updateTable("passwordResetCodes")
        .set({ usedAt: now })
        .where("userId", "=", user.id)
        .where("usedAt", "is", null)
        .execute();
      await trx
        .insertInto("passwordResetCodes")
        .values({
          userId: user.id,
          codeHash: hashResetCode(user.id, code),
          expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
        })
        .execute();
    });

    return new Response(
      superjson.stringify({
        code,
        expiresInMinutes: CODE_TTL_MINUTES,
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
      } satisfies OutputType),
    );
  } catch (error) {
    const authResponse = authErrorResponse(error, superjson.stringify);
    if (authResponse) return authResponse;
    console.error("reset code error", error);
    return new Response(
      superjson.stringify({ error: "Não foi possível gerar o código." }),
      { status: 400 },
    );
  }
}