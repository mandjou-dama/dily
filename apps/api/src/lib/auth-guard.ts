import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AccessTokenSigner } from "../modules/auth/tokens.js";
import { AppError } from "./errors.js";
import type { RateLimiter, RateLimitRule } from "./rate-limit.js";

/**
 * Authenticated HTTP requests per user, far above normal use: bounds what one
 * account, or a modified client, can cost.
 */
export const API_USER_RATE_LIMIT: RateLimitRule = {
  max: 300,
  windowSeconds: 60,
};

export interface AuthenticatedUser {
  id: string;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by `requireAuth`; missing on public routes. */
    authUser?: AuthenticatedUser;
  }
}

/** The request's user (call from a route behind `requireAuth`). */
export function authUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.authUser)
    throw new AppError(401, "unauthorized", "Sign in required.");
  return request.authUser;
}

export type Authenticate = (
  accessToken: string | undefined,
) => Promise<AuthenticatedUser>;

/**
 * Verifies an access JWT, then checks the account still exists: a deleted
 * account loses access at once, without waiting for the JWT to expire.
 */
export function createAuthenticator(deps: {
  prisma: PrismaClient;
  accessTokens: AccessTokenSigner;
  /** Same clock as the one signing tokens (tests at a fixed date). */
  now?: () => Date;
}): Authenticate {
  const now = deps.now ?? (() => new Date());
  return async (token) => {
    if (!token) throw new AppError(401, "unauthorized", "Sign in required.");

    const userId = await deps.accessTokens.verify(token, now());
    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new AppError(401, "unauthorized", "Invalid session.");
    return user;
  };
}

/** Guard for HTTP routes: `Authorization: Bearer …`, then the per-user request cap. */
export function createRequireAuth(
  authenticate: Authenticate,
  rateLimiter?: RateLimiter,
): preHandlerAsyncHookHandler {
  return async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    request.authUser = await authenticate(token);
    await rateLimiter?.consume(
      `api:user:${request.authUser.id}`,
      API_USER_RATE_LIMIT,
    );
  };
}
