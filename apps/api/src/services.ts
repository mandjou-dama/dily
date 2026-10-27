import { resolve } from "node:path";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { AppDeps } from "./app.js";
import type { Config } from "./config.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import {
  createAuthenticator,
  createRequireAuth,
  type Authenticate,
} from "./lib/auth-guard.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { ChatService } from "./modules/chat/chat.service.js";
import {
  ConsoleOtpSender,
  NoOtpSender,
  WhatsAppOtpSender,
  type OtpSender,
} from "./modules/auth/otp-sender.js";
import { OtpService } from "./modules/auth/otp.service.js";
import { AccessTokenSigner } from "./modules/auth/tokens.js";
import { MediaService } from "./modules/media/media.service.js";
import {
  DiskMediaStorage,
  type MediaStorage,
} from "./modules/media/storage.js";
import {
  expoPushSender,
  PushService,
  type PushSender,
} from "./modules/notifications/push.service.js";
import { ModerationService } from "./modules/moderation/moderation.service.js";
import { OffersService } from "./modules/offers/offers.service.js";
import { HandoverService } from "./modules/orders/handover.service.js";
import { OrdersService } from "./modules/orders/orders.service.js";
import {
  SimulatedPaymentGateway,
  type PaymentGateway,
} from "./modules/orders/payment-gateway.js";
import { ProductsService } from "./modules/products/products.service.js";
import { UserNotifier } from "./modules/realtime/notifier.js";
import { SellService } from "./modules/sell/sell.service.js";
import { MeService } from "./modules/users/me.service.js";

type ServicesConfig = Pick<
  Config,
  | "PHONE_HASH_PEPPER"
  | "JWT_ACCESS_SECRET"
  | "JWT_ACCESS_TTL_SECONDS"
  | "REFRESH_TOKEN_TTL_SECONDS"
  | "OTP_SENDER"
  | "TEST_PHONES"
  | "TEST_PHONE_CODE"
  | "WHATSAPP_API_BASE"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_ACCESS_TOKEN"
  | "WHATSAPP_TEMPLATE_NAME"
  | "WHATSAPP_TEMPLATE_LANGUAGE"
  | "MEDIA_DIR"
  | "EXPO_ACCESS_TOKEN"
  | "PAYMENT_GATEWAY"
  | "PAYMENT_SIMULATED_DELAY_MS"
>;

export interface ServicesInput {
  config: ServicesConfig;
  prisma: PrismaClient;
  redis: Redis;
  logger: FastifyBaseLogger;
  /** Replaces the code sender (tests). */
  otpSender?: OtpSender;
  /** Replaces the image store (tests). */
  mediaStorage?: MediaStorage;
  /** Replaces Expo Push (tests). */
  pushSender?: PushSender;
  /** Replaces the mobile money operators (tests). */
  paymentGateway?: PaymentGateway;
  now?: () => Date;
}

export interface Services extends AppDeps {
  authenticate: Authenticate;
  /** Bound to Socket.IO once it's attached (server.ts). */
  notifier: UserNotifier;
}

/** Builds the domain services from the infrastructure. */
export function createServices(input: ServicesInput): Services {
  const { config, prisma, redis } = input;
  const now = input.now ? { now: input.now } : {};

  const otp = new OtpService(
    redis,
    input.otpSender ?? createOtpSender(config, input.logger),
    {
      pepper: config.PHONE_HASH_PEPPER,
      testPhones: config.TEST_PHONES,
      testCode: config.TEST_PHONE_CODE,
    },
  );
  const rateLimiter = new RateLimiter(redis);
  const accessTokens = new AccessTokenSigner({
    secret: config.JWT_ACCESS_SECRET,
    ttlSeconds: config.JWT_ACCESS_TTL_SECONDS,
  });
  const auth = new AuthService({
    prisma,
    otp,
    rateLimiter,
    accessTokens,
    pepper: config.PHONE_HASH_PEPPER,
    refreshTokenTtlSeconds: config.REFRESH_TOKEN_TTL_SECONDS,
    ...now,
  });

  const mediaDir = resolve(config.MEDIA_DIR);
  const media = new MediaService({
    prisma,
    storage: input.mediaStorage ?? new DiskMediaStorage(mediaDir),
  });
  const authenticate = createAuthenticator({ prisma, accessTokens, ...now });
  const notifier = new UserNotifier();
  const push = new PushService({
    prisma,
    sender: input.pushSender ?? expoPushSender(config.EXPO_ACCESS_TOKEN),
    logger: input.logger,
  });
  const chatDeps = {
    prisma,
    notifier,
    push,
    rateLimiter,
    logger: input.logger,
    ...now,
  };
  const gateway =
    input.paymentGateway ?? createPaymentGateway(config, input.logger);
  const handover = new HandoverService({ ...chatDeps, media, gateway });

  return {
    health: {
      postgres: () => prisma.$queryRaw`SELECT 1`,
      redis: () => redis.ping(),
    },
    auth,
    me: new MeService({
      prisma,
      media,
      onPayoutAccountChange: (userId) => handover.payoutAccountChanged(userId),
    }),
    products: new ProductsService({ prisma, ...now }),
    sell: new SellService({ prisma, media, ...now }),
    media,
    chat: new ChatService(chatDeps),
    offers: new OffersService(chatDeps),
    orders: new OrdersService({ ...chatDeps, gateway }),
    handover,
    moderation: new ModerationService(chatDeps),
    push,
    rateLimiter,
    requireAuth: createRequireAuth(authenticate, rateLimiter),
    authenticate,
    notifier,
    mediaDir,
  };
}

function createPaymentGateway(
  config: ServicesConfig,
  logger: FastifyBaseLogger,
): PaymentGateway {
  switch (config.PAYMENT_GATEWAY) {
    case "simulated":
      return new SimulatedPaymentGateway(
        config.PAYMENT_SIMULATED_DELAY_MS,
        logger,
      );
  }
}

function createOtpSender(
  config: ServicesConfig,
  logger: FastifyBaseLogger,
): OtpSender {
  switch (config.OTP_SENDER) {
    case "console":
      return new ConsoleOtpSender(logger);
    case "none":
      return new NoOtpSender();
    case "whatsapp":
      return new WhatsAppOtpSender(
        {
          apiBase: config.WHATSAPP_API_BASE,
          // Both checked by loadConfig when OTP_SENDER=whatsapp
          phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID ?? "",
          accessToken: config.WHATSAPP_ACCESS_TOKEN ?? "",
          templateName: config.WHATSAPP_TEMPLATE_NAME,
          templateLanguage: config.WHATSAPP_TEMPLATE_LANGUAGE,
        },
        logger,
      );
  }
}
