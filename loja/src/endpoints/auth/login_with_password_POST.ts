// adapt this to your database schema
import { db } from "../../helpers/db";
import { sql } from "kysely";
import { schema } from "./login_with_password_POST.schema";
import { conferirSenha as compare } from "../../helpers/senha";
import { randomBytes } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { User } from "../../helpers/User";
import superjson from "superjson";
import { isValidCpf } from "../../helpers/isValidCpf";

// Configuration constants
const RATE_LIMIT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 15,
  cleanupProbability: 0.1,
} as const;

// Helper function to safely convert union type to Date
function safeToDate(
  value: string | number | bigint | Date | null | undefined
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  // kysely types max() over a timestamp column as possibly a Date.
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "bigint") {
    // Convert bigint to number (assuming it's a timestamp in milliseconds)
    return new Date(Number(value));
  }

  return new Date(value);
}

/**
 * Finds the account for what was typed on the login screen:
 * an e-mail, a CPF or a phone number. Returns "ambiguous" when more than one
 * account uses the same phone (for example, a family sharing a number).
 */
async function resolveAccount(
  raw: string
): Promise<{ id: number; email: string } | "ambiguous" | null> {
  const value = raw.trim();
  if (value.includes("@")) {
    const user = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where(sql`LOWER(users.email)`, "=", value.toLowerCase())
      .executeTakeFirst();
    return user ?? null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;

  // 11 digits can be a CPF or a mobile number with area code: try CPF first.
  if (digits.length === 11 && isValidCpf(digits)) {
    const byCpf = await db
      .selectFrom("customerProfiles")
      .innerJoin("users", "users.id", "customerProfiles.userId")
      .select(["users.id", "users.email"])
      .where("customerProfiles.cpf", "=", digits)
      .execute();
    if (byCpf.length === 1) return byCpf[0];
    if (byCpf.length > 1) return "ambiguous";
  }

  const phones = [digits];
  if (digits.startsWith("55") && digits.length > 11) phones.push(digits.slice(2));
  const byPhone = await db
    .selectFrom("customerProfiles")
    .innerJoin("users", "users.id", "customerProfiles.userId")
    .select(["users.id", "users.email"])
    .where("customerProfiles.phone", "in", phones)
    .execute();
  if (byPhone.length === 1) return byPhone[0];
  if (byPhone.length > 1) return "ambiguous";
  return null;
}

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { identifier, password } = schema.parse(json);

    const resolved = await resolveAccount(identifier);
    if (resolved === "ambiguous") {
      return new Response(
        superjson.stringify({
          message:
            "Mais de uma conta usa esse dado. Entre com o e-mail ou com o CPF.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    // One lockout counter per ACCOUNT, however the person identifies themselves
    // (e-mail, CPF or phone). Unknown identifiers get their own counter.
    const normalizedEmail = resolved
      ? resolved.email.toLowerCase()
      : `ident:${identifier.trim().toLowerCase()}`.slice(0, 200);
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - RATE_LIMIT_CONFIG.lockoutWindowMinutes * 60 * 1000
    );

    // Start transaction for atomic rate limiting and session creation
    const result = await db.transaction().execute(async (trx) => {
      // Use PostgreSQL advisory lock to serialize access per email
      // This prevents concurrent processing of the same email address
      // The lock is automatically released when the transaction ends
      // (no D1 não há trava por e-mail; o limite de tentativas continua valendo)

      // Get rate limiting info efficiently - use COUNT and MAX instead of SELECT *
      const rateLimitQuery = await trx
        .selectFrom("loginAttempts")
        .select([
          trx.fn.countAll<number>().as("failedCount"),
          trx.fn.max(trx.dynamic.ref("attemptedAt")).as("lastFailedAt"),
        ])
        .where("email", "=", normalizedEmail)
        .where("success", "=", false)
        .where("attemptedAt", ">=", windowStart)
        .where("attemptedAt", "is not", null) // Ensure null safety
        .executeTakeFirst();

      const { failedCount = 0, lastFailedAt = null } = rateLimitQuery || {};
      const safeLastFailedAt = safeToDate(lastFailedAt);

      // Check if user is locked out
      if (
        rateLimitQuery &&
        failedCount >= RATE_LIMIT_CONFIG.maxFailedAttempts &&
        safeLastFailedAt
      ) {
        const lockoutEnd = new Date(
          safeLastFailedAt.getTime() +
            RATE_LIMIT_CONFIG.lockoutDurationMinutes * 60 * 1000
        );

        if (now < lockoutEnd) {
          const remainingMinutes = Math.ceil(
            (lockoutEnd.getTime() - now.getTime()) / (60 * 1000)
          );
          // DO NOT log blocked attempts to prevent extending lockout indefinitely
          return {
            type: "rate_limited" as const,
            remainingMinutes,
          };
        }
      }

      // Find user by email (normalized)
      const userResults = await trx
        .selectFrom("users")
        .innerJoin("userPasswords", "users.id", "userPasswords.userId")
        .select([
          "users.id",
          "users.email",
          "users.displayName",
          "users.avatarUrl",
          "users.role",
          "userPasswords.passwordHash",
        ])
        .where("users.id", "=", resolved ? resolved.id : -1)
        .limit(1)
        .execute();

      if (userResults.length === 0) {
        // Log failed attempt for non-existent user
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedEmail,
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      const user = userResults[0];

      // Verify password
      const passwordValid = await compare(password, user.passwordHash);
      if (!passwordValid) {
        // Log failed attempt for invalid password
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedEmail,
            attemptedAt: now,
            success: false,
          })
          .execute();

        return {
          type: "auth_failed" as const,
        };
      }

      // Password is valid - log successful attempt
      await trx
        .insertInto("loginAttempts")
        .values({
          email: normalizedEmail,
          attemptedAt: now,
          success: true,
        })
        .execute();

      // Create session inside the same transaction to ensure atomicity
      const sessionId = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        now.getTime() + SessionExpirationSeconds * 1000
      );

      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: user.id,
          createdAt: now,
          lastAccessed: now,
          expiresAt: expiresAt,
        })
        .execute();

      // Reset failed attempts counter by deleting previous failed attempts
      // This preserves audit trail of successful logins
      await trx
        .deleteFrom("loginAttempts")
        .where("email", "=", normalizedEmail)
        .where("success", "=", false)
        .execute();

      return {
        type: "success" as const,
        user,
        sessionId,
        sessionCreatedAt: now,
      };
    });

    // Clean up old login attempts periodically
    // Run cleanup outside transaction to prevent extending transaction time and potential deadlocks
    if (Math.random() < RATE_LIMIT_CONFIG.cleanupProbability) {
      const cleanupBefore = new Date(
        now.getTime() - RATE_LIMIT_CONFIG.lockoutWindowMinutes * 60 * 1000
      );
      try {
        const deleteResult = await db
          .deleteFrom("loginAttempts")
          .where("attemptedAt", "<", cleanupBefore)
          .where("attemptedAt", "is not", null)
          .executeTakeFirst();
      } catch {
        // Don't fail the login if cleanup fails
      }
    }

    // Handle different transaction results
    if (result.type === "rate_limited") {
      return new Response(
        superjson.stringify({
          message: `Muitas tentativas erradas. Conta bloqueada por mais ${result.remainingMinutes} minutos. Se esqueceu a senha, use "Esqueci minha senha".`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (result.type === "auth_failed") {
      return new Response(
        superjson.stringify({ message: "Dados de acesso ou senha incorretos." }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Success case - session was already created in transaction
    const user = result.user;

    // Create response with user data (excluding sensitive information)
    const userData: User = {
      id: user.id,
      email: user.email,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      role: user.role,
    };

    const response = new Response(
      superjson.stringify({
        user: userData,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Set session cookie
    await setServerSession(response, {
      id: result.sessionId,
      createdAt: result.sessionCreatedAt.getTime(),
      lastAccessed: result.sessionCreatedAt.getTime(),
    });

    return response;
  } catch (error) {
    return new Response(
      superjson.stringify({ message: "Authentication failed" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
