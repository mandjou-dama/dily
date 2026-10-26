import { z } from "zod";
import { phoneE164Schema } from "./phone";

export const DEFAULT_CITY = "Bamako";

export const profileSchema = z.object({
  id: z.uuid(),
  phone: phoneE164Schema,
  fullName: z.string().nullable(),
  /** Media path, or an external URL (seed data only). */
  avatarPath: z.string().nullable(),
  // Where the seller meets buyers: "Hamdallaye ACI"
  neighbourhood: z.string().nullable(),
  city: z.string(),
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
export type ProfileUpdate = z.output<typeof profileUpdateBodySchema>;
