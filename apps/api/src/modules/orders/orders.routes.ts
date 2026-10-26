import { directBuyBodySchema, paymentBodySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { OrdersService } from "./orders.service.js";

export interface OrdersRoutesOptions {
  orders: OrdersService;
  requireAuth: preHandlerAsyncHookHandler;
}

const paymentParamsSchema = z.object({ id: z.uuid(), paymentId: z.uuid() });

export const ordersRoutes: FastifyPluginAsync<OrdersRoutesOptions> = async (
  app,
  { orders, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.post("/orders", async (request, reply) => {
    const body = parseInput(directBuyBodySchema, request.body);
    const order = await orders.buy(authUser(request).id, body);
    return reply.code(201).send(order);
  });

  app.get("/orders/:id", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    return orders.get(authUser(request).id, id);
  });

  app.post("/orders/:id/payments", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const body = parseInput(paymentBodySchema, request.body);
    const payment = await orders.pay(authUser(request).id, id, body);
    return reply.code(201).send(payment);
  });

  app.post("/orders/:id/payments/:paymentId/cancel", async (request) => {
    const { id, paymentId } = parseInput(paymentParamsSchema, request.params);
    return orders.cancelPayment(authUser(request).id, id, paymentId);
  });
};
