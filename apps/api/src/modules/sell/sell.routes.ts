import { listingBodySchema, listingStatusBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { SellService } from "./sell.service.js";

export interface SellRoutesOptions {
  sell: SellService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const sellRoutes: FastifyPluginAsync<SellRoutesOptions> = async (
  app,
  { sell, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.post("/listings", async (request, reply) => {
    const listing = parseInput(listingBodySchema, request.body);
    const id = await sell.create(authUser(request).id, listing);
    return reply.code(201).send({ id });
  });

  app.put("/listings/:id", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const listing = parseInput(listingBodySchema, request.body);
    await sell.update(authUser(request).id, id, listing);
    return reply.code(204).send();
  });

  app.patch("/listings/:id/status", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const { sold } = parseInput(listingStatusBodySchema, request.body);
    await sell.setSold(authUser(request).id, id, sold);
    return reply.code(204).send();
  });

  app.delete("/listings/:id", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await sell.delete(authUser(request).id, id);
    return reply.code(204).send();
  });
};
