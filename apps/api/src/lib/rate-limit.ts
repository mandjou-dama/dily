import type { Redis } from "ioredis";
import { AppError } from "./errors.js";

export interface RateLimitRule {
  /** Most occurrences allowed in the window. */
  max: number;
  windowSeconds: number;
}

/**
 * Fixed-window limiter in Redis, one key per subject (number, IP, user…).
 * Throws 429 `rate_limited` with `Retry-After` past the limit.
 */
export class RateLimiter {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, rule: RateLimitRule): Promise<void> {
    const fullKey = `ratelimit:${key}`;
    const results = await this.redis
      .multi()
      .incr(fullKey)
      .expire(fullKey, rule.windowSeconds, "NX")
      .ttl(fullKey)
      .exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? rule.windowSeconds);
    if (count > rule.max) {
      throw new AppError(
        429,
        "rate_limited",
        "Too many attempts. Try again later.",
        {
          "retry-after": String(Math.max(ttl, 1)),
        },
      );
    }
  }
}
