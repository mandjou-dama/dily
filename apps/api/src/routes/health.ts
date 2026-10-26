import type { FastifyPluginAsync } from "fastify";

export interface HealthChecks {
  postgres: () => Promise<unknown>;
  redis: () => Promise<unknown>;
}

/** 200 when Postgres and Redis answer, 503 otherwise. */
export const healthRoutes: FastifyPluginAsync<HealthChecks> = async (
  app,
  checks,
) => {
  app.get("/health", async (_request, reply) => {
    const [postgres, redis] = await Promise.allSettled([
      checks.postgres(),
      checks.redis(),
    ]);
    const status = {
      postgres: postgres.status === "fulfilled" ? "ok" : "down",
      redis: redis.status === "fulfilled" ? "ok" : "down",
    };
    const healthy = status.postgres === "ok" && status.redis === "ok";
    return reply.code(healthy ? 200 : 503).send(status);
  });
};
