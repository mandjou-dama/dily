import { pushTokenBodySchema, removePushTokenBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput } from "../../lib/validation.js";
import type { PushService } from "./push.service.js";

export interface PushRoutesOptions {
  push: PushService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const pushRoutes: FastifyPluginAsync<PushRoutesOptions> = async (
  app,
  { push, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.put("/me/push-token", async (request, reply) => {
    const body = parseInput(pushTokenBodySchema, request.body);
    await push.register(authUser(request).id, body);
    return reply.code(204).send();
  });

  app.delete("/me/push-token", async (request, reply) => {
    const { token } = parseInput(removePushTokenBodySchema, request.body);
    await push.unregister(authUser(request).id, token);
    return reply.code(204).send();
  });
};
