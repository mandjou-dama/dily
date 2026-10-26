import { z } from "zod";

// Mali only for now: +223 followed by 8 digits
export const COUNTRY_CODE = "223";
export const LOCAL_PHONE_LENGTH = 8;

/** Account phone number in E.164, e.g. "+22370000000". */
export const phoneE164Schema = z
  .string()
  .regex(/^\+223\d{8}$/, "Invalid phone number");

export type PhoneE164 = z.infer<typeof phoneE164Schema>;
