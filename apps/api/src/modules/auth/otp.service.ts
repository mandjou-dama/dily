import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { OTP_CODE_LENGTH, type PhoneE164 } from "@dily/shared";
import type { Redis } from "ioredis";
import { AppError } from "../../lib/errors.js";
import { hashPhone } from "../../lib/phone-hash.js";
import type { OtpSender } from "./otp-sender.js";

export interface OtpOptions {
  /** Secret salt: neither the number nor the code is stored in clear in Redis. */
  pepper: string;
  ttlSeconds?: number;
  maxAttempts?: number;
  /** Test numbers: never messaged, the code is always `testCode` (ignored without a code). */
  testPhones?: readonly PhoneE164[];
  testCode?: string | undefined;
}

// Counts an attempt only if the code still exists (HINCRBY would otherwise recreate a key with no TTL)
const CONSUME_ATTEMPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return {-1} end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {attempts, redis.call('HGET', KEYS[1], 'codeHash')}
`;

const expiredError = () =>
  new AppError(400, "otp_expired", "This code has expired. Ask for a new one.");

/**
 * One-time sign-in codes: 6 digits, 10 minutes, 5 attempts. Only an HMAC of
 * the code is stored, under a key derived from the number's hash. Test
 * numbers follow the same path with a fixed code and no message.
 */
export class OtpService {
  readonly ttlSeconds: number;
  readonly maxAttempts: number;
  private readonly testPhones: ReadonlySet<PhoneE164>;

  constructor(
    private readonly redis: Redis,
    private readonly sender: OtpSender,
    private readonly options: OtpOptions,
  ) {
    this.ttlSeconds = options.ttlSeconds ?? 600;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.testPhones = new Set(options.testCode ? options.testPhones : []);
  }

  isTestPhone(phone: PhoneE164): boolean {
    return this.testPhones.has(phone);
  }

  private keyFor(phone: PhoneE164): string {
    return `otp:${hashPhone(phone, this.options.pepper)}`;
  }

  /** Creates a new code (replacing the previous one and its attempts) and sends it. */
  async issue(phone: PhoneE164): Promise<void> {
    const testCode = this.isTestPhone(phone)
      ? this.options.testCode
      : undefined;
    const code =
      testCode ??
      String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(
        OTP_CODE_LENGTH,
        "0",
      );
    const key = this.keyFor(phone);
    await this.redis
      .multi()
      .del(key)
      .hset(key, { codeHash: this.hashCode(phone, code), attempts: 0 })
      .expire(key, this.ttlSeconds)
      .exec();
    if (testCode) return;

    try {
      await this.sender.send(phone, code);
    } catch (error) {
      // The message didn't go out: nobody could use this code
      await this.redis.del(key);
      throw error;
    }
  }

  /** Checks the code and consumes it on success. Throws an `AppError` otherwise. */
  async verify(phone: PhoneE164, code: string): Promise<void> {
    const key = this.keyFor(phone);
    const [attempts, storedHash] = (await this.redis.eval(
      CONSUME_ATTEMPT_SCRIPT,
      1,
      key,
    )) as [number, string?];

    if (attempts === -1 || !storedHash) throw expiredError();
    if (attempts > this.maxAttempts) {
      throw new AppError(
        429,
        "otp_too_many_attempts",
        "Too many attempts. Ask for a new code.",
      );
    }

    const expected = Buffer.from(storedHash, "hex");
    const actual = Buffer.from(this.hashCode(phone, code), "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new AppError(400, "otp_invalid", "Wrong code.");
    }

    // DEL returns 0 when a concurrent request already used the code: one use only
    if ((await this.redis.del(key)) === 0) throw expiredError();
  }

  private hashCode(phone: PhoneE164, code: string): string {
    return createHmac("sha256", this.options.pepper)
      .update(`otp:${phone}:${code}`)
      .digest("hex");
  }
}
