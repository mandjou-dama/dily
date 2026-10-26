import { offerBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { OffersService } from "./offers.service.js";

export interface OffersRoutesOptions {
  offers: OffersService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const offersRoutes: FastifyPluginAsync<OffersRoutesOptions> = async (
  app,
  { offers, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.post("/conversations/:id/offers", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const body = parseInput(offerBodySchema, request.body);
    const message = await offers.create(authUser(request).id, id, body);
    return reply.code(201).send(message);
  });

  app.post("/offers/:id/accept", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    return offers.accept(authUser(request).id, id);
  });

  app.post("/offers/:id/decline", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    return offers.decline(authUser(request).id, id);
  });
};
