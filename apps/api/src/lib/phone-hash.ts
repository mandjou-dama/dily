import { createHmac } from "node:crypto";
import type { PhoneE164 } from "@dily/shared";

/**
 * Deterministic hash of a number. HMAC with a secret pepper: a plain SHA-256
 * would fall to brute force, phone numbers being a small space.
 */
export function hashPhone(phone: PhoneE164, pepper: string): string {
  return createHmac("sha256", pepper).update(phone).digest("hex");
}
