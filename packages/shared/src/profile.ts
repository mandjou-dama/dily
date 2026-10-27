import { z } from "zod";
import { paymentProviderSchema } from "./orders";
import { phoneE164Schema } from "./phone";

export const DEFAULT_CITY = "Bamako";

/**
 * The terms of use in force: a new date asks every account to accept them
 * again. Change it with the app's text (terms in the French locale).
 */
export const TERMS_VERSION = "2026-10-27";

/** Where a seller receives what buyers paid. */
export const payoutAccountSchema = z.object({
  provider: paymentProviderSchema,
  phone: phoneE164Schema,
});
export type PayoutAccount = z.infer<typeof payoutAccountSchema>;

export const profileSchema = z.object({
  id: z.uuid(),
  phone: phoneE164Schema,
  fullName: z.string().nullable(),
  /** Media path, or an external URL (seed data only). */
  avatarPath: z.string().nullable(),
  // Where the seller meets buyers: "Hamdallaye ACI"
  neighbourhood: z.string().nullable(),
  city: z.string(),
  // Null until the seller says where to receive money
  payoutAccount: payoutAccountSchema.nullable(),
  // The terms version the user accepted; the app asks again until it's TERMS_VERSION
  termsVersion: z.string().nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileUpdateBodySchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  // Blank or null clears it
  neighbourhood: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
});
export type ProfileUpdateBody = z.input<typeof profileUpdateBodySchema>;

/** `PUT /me/terms`: the user accepts the terms of use shown to them. */
export const acceptTermsBodySchema = z.object({ version: z.string().min(1) });
export type AcceptTermsBody = z.input<typeof acceptTermsBodySchema>;
export type ProfileUpdate = z.output<typeof profileUpdateBodySchema>;
