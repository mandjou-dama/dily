import { Redis } from "ioredis";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrisma } from "../src/lib/prisma.js";

const testDatabaseUrl = process.env["TEST_DATABASE_URL"];
const testRedisUrl = process.env["TEST_REDIS_URL"];

/** `describe.skipIf(!hasTestServices)` for suites that need Postgres and Redis. */
export const hasTestServices = Boolean(testDatabaseUrl && testRedisUrl);

export function createTestPrisma(): PrismaClient {
  if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL missing");
  return createPrisma(testDatabaseUrl);
}

export function createTestRedis(): Redis {
  if (!testRedisUrl) throw new Error("TEST_REDIS_URL missing");
  return new Redis(testRedisUrl, { maxRetriesPerRequest: 1 });
}

/** Empties every table (except the migrations history) and the test Redis db. */
export async function resetState(
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  }
  await redis.flushdb();
}
