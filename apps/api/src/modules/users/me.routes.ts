import { payoutAccountSchema, profileUpdateBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import type { RateLimiter } from "../../lib/rate-limit.js";
import { parseInput } from "../../lib/validation.js";
import { readImageUpload, UPLOAD_RATE_LIMIT } from "../media/media.routes.js";
import type { MeService } from "./me.service.js";

export interface MeRoutesOptions {
  me: MeService;
  rateLimiter: RateLimiter;
  requireAuth: preHandlerAsyncHookHandler;
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  app,
  { me, rateLimiter, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.get("/me", async (request) => me.get(authUser(request).id));

  app.patch("/me", async (request) => {
    const body = parseInput(profileUpdateBodySchema, request.body);
    return me.update(authUser(request).id, body);
  });

  app.put("/me/payout-account", async (request) => {
    const body = parseInput(payoutAccountSchema, request.body);
    return me.setPayoutAccount(authUser(request).id, body);
  });

  app.put("/me/avatar", async (request) => {
    const user = authUser(request);
    await rateLimiter.consume(`upload:user:${user.id}`, UPLOAD_RATE_LIMIT);
    return me.setAvatar(user.id, await readImageUpload(request));
  });

  app.delete("/me", async (request, reply) => {
    await me.deleteAccount(authUser(request).id);
    return reply.code(204).send();
  });
};
