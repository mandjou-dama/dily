// Dily's decision on a problem a buyer reported, until an admin screen exists:
//   pnpm --filter @dily/api dispute:resolve <order id> refund|release
// refund: the buyer gets their money back, the listing is on sale again.
// release: the money goes to the seller. Both sides get a push; the apps
// show it next time they load the conversation. The transfer is sent from
// here, and tried again by the API's job if the operator's answer comes
// back to the API instead.
import Fastify from "fastify";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { createPrisma } from "../lib/prisma.js";
import { createRedis } from "../lib/redis.js";
import { createServices } from "../services.js";

const args = z
  .tuple([z.uuid(), z.enum(["refund", "release"])])
  .safeParse(process.argv.slice(2));
if (!args.success) {
  console.error("usage: dispute:resolve <order id> refund|release");
  process.exit(1);
}
const [orderId, decision] = args.data;

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const redis = createRedis(config.REDIS_URL);
const services = createServices({
  config,
  prisma,
  redis,
  logger: Fastify().log,
});
try {
  await services.handover.resolveDispute(orderId, decision);
  console.log(`Order ${orderId}: ${decision} done.`);
} finally {
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
}
