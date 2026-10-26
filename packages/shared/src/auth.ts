import { z } from "zod";
import { phoneE164Schema } from "./phone";

export const OTP_CODE_LENGTH = 6;

/** Stable id of the app install, generated on first launch: one session per device. */
export const deviceIdSchema = z.string().trim().min(8).max(128);

export const otpRequestBodySchema = z.object({
  phone: phoneE164Schema,
});
export type OtpRequestBody = z.infer<typeof otpRequestBodySchema>;

export const otpVerifyBodySchema = z.object({
  phone: phoneE164Schema,
  code: z
    .string()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), "Invalid code"),
  deviceId: deviceIdSchema,
});
export type OtpVerifyBody = z.infer<typeof otpVerifyBodySchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(256),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

export const logoutBodySchema = refreshBodySchema;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  /** Lifetime of the access JWT, in seconds. */
  accessTokenExpiresIn: z.number().int().positive(),
  refreshToken: z.string(),
  userId: z.uuid(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const otpVerifyResponseSchema = authTokensSchema.extend({
  /** True when the account was just created: the app asks for the profile next. */
  isNewUser: z.boolean(),
});
export type OtpVerifyResponse = z.infer<typeof otpVerifyResponseSchema>;
