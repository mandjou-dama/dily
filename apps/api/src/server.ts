import { mkdir } from "node:fs/promises";
import Fastify from "fastify";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrisma } from "./lib/prisma.js";
import { createRedis } from "./lib/redis.js";
import { attachRealtime } from "./modules/realtime/realtime.js";
import { createServices } from "./services.js";

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const redis = createRedis(config.REDIS_URL);
redis.on("error", () => {
  // Connection errors show in /health; no unhandled crash
});

const logger = Fastify({ logger: { level: config.LOG_LEVEL } }).log;
const services = createServices({ config, prisma, redis, logger });
await mkdir(services.mediaDir, { recursive: true });
const app = buildApp(services, {
  loggerInstance: logger,
  trustProxy: config.TRUST_PROXY,
});
const realtime = attachRealtime(app, { authenticate: services.authenticate });
services.notifier.bind(realtime.emitToUser);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
