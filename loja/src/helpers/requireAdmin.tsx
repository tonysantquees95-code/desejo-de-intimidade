import { getServerUserSession } from "./getServerUserSession";
import { NotAuthenticatedError } from "./getSetServerSession";

export class ForbiddenError extends Error {
  constructor() {
    super("Acesso restrito ao administrador.");
    this.name = "ForbiddenError";
  }
}

/** Throws NotAuthenticatedError / ForbiddenError unless the caller is an admin. */
export async function requireAdmin(request: Request) {
  const { user } = await getServerUserSession(request);
  if (user.role !== "admin") {
    throw new ForbiddenError();
  }
  return user;
}

/** Maps auth errors to a Response, or returns null for other errors. */
export function authErrorResponse(
  error: unknown,
  stringify: (value: unknown) => string,
): Response | null {
  if (error instanceof NotAuthenticatedError) {
    return new Response(
      stringify({ error: "Faça login para continuar." }),
      { status: 401 },
    );
  }
  if (error instanceof ForbiddenError) {
    return new Response(stringify({ error: error.message }), { status: 403 });
  }
  return null;
}