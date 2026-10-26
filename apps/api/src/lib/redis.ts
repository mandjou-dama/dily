import { Redis } from "ioredis";

export function createRedis(redisUrl: string): Redis {
  // Fail fast when Redis is down, so /health answers quickly
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
}
