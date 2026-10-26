import { feedQuerySchema } from "@dily/shared";
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { parseInput, uuidParamSchema } from "../../lib/validation.js";
import type { ProductsService } from "./products.service.js";

export interface ProductsRoutesOptions {
  products: ProductsService;
  requireAuth: preHandlerAsyncHookHandler;
}

export const productsRoutes: FastifyPluginAsync<ProductsRoutesOptions> = async (
  app,
  { products, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.get("/categories", async () => products.categories());

  app.get("/products", async (request) =>
    products.feed(parseInput(feedQuerySchema, request.query)),
  );

  app.get("/products/picks", async () => products.picks());

  app.get("/products/:id", async (request) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    return products.product(authUser(request).id, id);
  });

  app.get("/me/likes", async (request) => ({
    productIds: await products.likedIds(authUser(request).id),
  }));

  app.put("/products/:id/like", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await products.like(authUser(request).id, id);
    return reply.code(204).send();
  });

  app.delete("/products/:id/like", async (request, reply) => {
    const { id } = parseInput(uuidParamSchema, request.params);
    await products.unlike(authUser(request).id, id);
    return reply.code(204).send();
  });
};
