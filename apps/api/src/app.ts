import type { ApiError } from "@dily/shared";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
  type preHandlerAsyncHookHandler,
} from "fastify";
import { AppError } from "./lib/errors.js";
import type { RateLimiter } from "./lib/rate-limit.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import type { AuthService } from "./modules/auth/auth.service.js";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import type { ChatService } from "./modules/chat/chat.service.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { offersRoutes } from "./modules/offers/offers.routes.js";
import type { OffersService } from "./modules/offers/offers.service.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import type { HandoverService } from "./modules/orders/handover.service.js";
import type { OrdersService } from "./modules/orders/orders.service.js";
import type { MediaService } from "./modules/media/media.service.js";
import { pushRoutes } from "./modules/notifications/push.routes.js";
import type { PushService } from "./modules/notifications/push.service.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import type { ProductsService } from "./modules/products/products.service.js";
import { sellRoutes } from "./modules/sell/sell.routes.js";
import type { SellService } from "./modules/sell/sell.service.js";
import { meRoutes } from "./modules/users/me.routes.js";
import type { MeService } from "./modules/users/me.service.js";
import { healthRoutes, type HealthChecks } from "./routes/health.js";

export interface AppDeps {
  health: HealthChecks;
  auth: AuthService;
  me: MeService;
  products: ProductsService;
  sell: SellService;
  media: MediaService;
  chat: ChatService;
  offers: OffersService;
  orders: OrdersService;
  handover: HandoverService;
  push: PushService;
  rateLimiter: RateLimiter;
  requireAuth: preHandlerAsyncHookHandler;
  /** Folder served under /media (disk storage). */
  mediaDir: string;
}

export function buildApp(
  deps: AppDeps,
  options: FastifyServerOptions = {},
): FastifyInstance {
  const app = Fastify(options);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiError = { error: error.code, message: error.message };
      return reply.code(error.statusCode).headers(error.headers).send(body);
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 413) {
      const body: ApiError = {
        error: "file_too_large",
        message: "This image is too large.",
      };
      return reply.code(413).send(body);
    }
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      // Fastify client errors: malformed JSON, missing content type… The
      // exact cause only goes to the logs
      request.log.warn(
        {
          code: (error as { code?: string }).code,
          statusCode,
          contentType: request.headers["content-type"],
        },
        "request refused",
      );
      const body: ApiError = {
        error: "validation_error",
        message: "Invalid request.",
      };
      return reply.code(400).send(body);
    }
    request.log.error({ err: error }, "unexpected error");
    const body: ApiError = {
      error: "internal_error",
      message: "Something went wrong.",
    };
    return reply.code(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = { error: "not_found", message: "Not found." };
    return reply.code(404).send(body);
  });

  app.register(fastifyMultipart);
  // Image files never change once written (new uploads get new names)
  app.register(fastifyStatic, {
    root: deps.mediaDir,
    prefix: "/media/",
    immutable: true,
    maxAge: "365d",
  });

  const { requireAuth, rateLimiter } = deps;
  app.register(healthRoutes, deps.health);
  app.register(authRoutes, { auth: deps.auth });
  app.register(meRoutes, { me: deps.me, rateLimiter, requireAuth });
  app.register(productsRoutes, { products: deps.products, requireAuth });
  app.register(sellRoutes, { sell: deps.sell, requireAuth });
  app.register(mediaRoutes, { media: deps.media, rateLimiter, requireAuth });
  app.register(chatRoutes, { chat: deps.chat, requireAuth });
  app.register(offersRoutes, { offers: deps.offers, requireAuth });
  app.register(ordersRoutes, {
    orders: deps.orders,
    handover: deps.handover,
    requireAuth,
  });
  app.register(pushRoutes, { push: deps.push, requireAuth });
  return app;
}
