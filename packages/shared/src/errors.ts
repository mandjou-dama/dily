import { z } from "zod";

/** Error codes the API sends in `{ error, message }`. */
export const apiErrorCodes = [
  "validation_error",
  "unauthorized",
  "forbidden",
  "not_found",
  // The state changed: offer already answered, listing reserved or sold
  "conflict",
  "rate_limited",
  "otp_invalid",
  "otp_expired",
  "otp_too_many_attempts",
  "otp_unavailable",
  "refresh_token_invalid",
  "file_too_large",
  "unsupported_image",
  // The handover code doesn't match
  "handover_code_invalid",
  // One of the two people blocked the other, or the other's account is
  // suspended: no more messages, offers or purchases between them
  "blocked",
  // Dily suspended the account (moderation): it can't sign in
  "account_suspended",
  "internal_error",
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: apiErrorCodeSchema,
  message: z.string(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
