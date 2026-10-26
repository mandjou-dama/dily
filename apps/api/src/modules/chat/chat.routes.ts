import {
  openConversationBodySchema,
  pageQuerySchema,
  sendMessageBodySchema,
} from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { ChatService } from "./chat.service.js";

export interface ChatRoutesOptions {
  chat: ChatService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const chatRoutes: FastifyPluginAsync<ChatRoutesOptions> = async (
  app,
  { chat, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.post("/conversations", async (request) => {
    const { productId } = parseInput(openConversationBodySchema, request.body);
    return chat.open(authUser(request).id, productId);
  });

  app.get("/conversations", async (request) => {
    const { cursor } = parseInput(pageQuerySchema, request.query);
    return chat.list(authUser(request).id, cursor);
  });

  app.get("/conversations/unread-count", async (request) => ({
    count: await chat.unreadCount(authUser(request).id),
  }));

  app.get("/conversations/:id", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    return chat.get(authUser(request).id, id);
  });

  app.get("/conversations/:id/messages", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const { cursor } = parseInput(pageQuerySchema, request.query);
    return chat.messages(authUser(request).id, id, cursor);
  });

  app.post("/conversations/:id/messages", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    const body = parseInput(sendMessageBodySchema, request.body);
    const message = await chat.send(authUser(request).id, id, body);
    return reply.code(201).send(message);
  });

  app.post("/conversations/:id/read", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await chat.markRead(authUser(request).id, id);
    return reply.code(204).send();
  });
};
