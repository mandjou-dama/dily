import { Queue, Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { Redis } from "ioredis";
import type { HandoverService } from "./handover.service.js";

export const ORDERS_QUEUE = "orders";
/** Reminders, refunds and transfers to try again: checked every minute. */
export const ORDERS_DUE_EVERY_MS = 60_000;

export interface OrdersJobsOptions {
  redisUrl: string;
  handover: HandoverService;
  logger: FastifyBaseLogger;
}

/**
 * The orders' deadlines (BullMQ): `due` every minute runs
 * HandoverService.runDue. The database is the truth: a restart loses
 * nothing, and several API instances never act twice. The scheduler is
 * idempotent (`upsertJobScheduler`).
 */
export async function startOrdersJobs(options: OrdersJobsOptions) {
  // BullMQ needs its own connection, retrying without limit
  const connection = new Redis(options.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(ORDERS_QUEUE, { connection });
  await queue.upsertJobScheduler(
    "orders-due",
    { every: ORDERS_DUE_EVERY_MS },
    { name: "due", opts: { removeOnComplete: 10, removeOnFail: 100 } },
  );
  const worker = new Worker(
    ORDERS_QUEUE,
    async (job) => {
      if (job.name !== "due") return null;
      const result = await options.handover.runDue();
      if (result.reminded + result.refunded + result.sent > 0) {
        options.logger.info(result, "orders: deadlines");
      }
      return result;
    },
    { connection },
  );
  worker.on("failed", (job, error) => {
    options.logger.error({ err: error, job: job?.name }, "orders: job failed");
  });

  return async () => {
    await worker.close();
    await queue.close();
    connection.disconnect();
  };
}
