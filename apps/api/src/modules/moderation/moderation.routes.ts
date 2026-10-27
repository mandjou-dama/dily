import { reportBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { ModerationService } from "./moderation.service.js";

export interface ModerationRoutesOptions {
  moderation: ModerationService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const moderationRoutes: FastifyPluginAsync<
  ModerationRoutesOptions
> = async (app, { moderation, requireAuth }) => {
  app.addHook("preHandler", requireAuth);

  app.post("/reports", async (request, reply) => {
    const body = parseInput(reportBodySchema, request.body);
    await moderation.report(authUser(request).id, body);
    return reply.code(204).send();
  });

  app.get("/me/blocks", async (request) =>
    moderation.blockedUsers(authUser(request).id),
  );

  app.put("/me/blocks/:id", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await moderation.block(authUser(request).id, id);
    return reply.code(204).send();
  });

  app.delete("/me/blocks/:id", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await moderation.unblock(authUser(request).id, id);
    return reply.code(204).send();
  });
};
