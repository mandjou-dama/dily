import { OTP_CODE_LENGTH, phoneE164Schema } from "@dily/shared";
import { z } from "zod";

/** Optional variable: empty means missing. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/** Comma-separated E.164 numbers, duplicates removed. */
const phoneList = z
  .string()
  .default("")
  .transform((v) => [
    ...new Set(
      v
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(phoneE164Schema));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    /**
     * Trusted proxies for X-Forwarded-For: `false`, or the proxies' addresses
     * or ranges, comma-separated. Never `true`: Fastify would then take the
     * leftmost address, set by the client, and per-IP rate limits would be
     * bypassed.
     */
    TRUST_PROXY: z
      .string()
      .default("false")
      .refine((v) => v.trim() !== "true", {
        message:
          "TRUST_PROXY=true is refused: list the proxies' addresses (e.g. loopback)",
      })
      .transform((v): false | string[] =>
        v.trim() === "false" || v.trim() === ""
          ? false
          : v
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean),
      ),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    PHONE_HASH_PEPPER: z
      .string()
      .min(32, "PHONE_HASH_PEPPER needs at least 32 characters"),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET needs at least 32 characters"),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(90 * 24 * 3600),
    /**
     * `console`: codes go to the logs (development, refused in production).
     * `whatsapp`: Meta's Cloud API. `none`: only TEST_PHONES can sign in.
     */
    OTP_SENDER: z.enum(["console", "whatsapp", "none"]).default("console"),
    /** Never messaged, the code is always TEST_PHONE_CODE; the account is marked tester. */
    TEST_PHONES: phoneList,
    /** Fixed code of the test numbers. Secret: anyone who knows it gets into those accounts. */
    TEST_PHONE_CODE: optional(
      z
        .string()
        .regex(
          new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`),
          `TEST_PHONE_CODE must be ${OTP_CODE_LENGTH} digits`,
        ),
    ),
    WHATSAPP_API_BASE: z.url().default("https://graph.facebook.com/v23.0"),
    WHATSAPP_PHONE_NUMBER_ID: optional(z.string().min(1)),
    WHATSAPP_ACCESS_TOKEN: optional(z.string().min(1)),
    WHATSAPP_TEMPLATE_NAME: z.string().min(1).default("dily_login_code"),
    WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("fr"),
    /** Folder of uploaded images, served under /media. */
    MEDIA_DIR: z.string().min(1).default("./uploads"),
    /** Only when "Enhanced security for push notifications" is on in the Expo project. */
    EXPO_ACCESS_TOKEN: optional(z.string().min(1)),
    /**
     * Orange Money and Moov Money. `simulated`: no money moves, payments
     * succeed after PAYMENT_SIMULATED_DELAY_MS except for test payer numbers
     * (development, refused in production). Real operators come later.
     */
    PAYMENT_GATEWAY: z.enum(["simulated"]).default("simulated"),
    PAYMENT_SIMULATED_DELAY_MS: z.coerce.number().int().min(0).default(4000),
    /**
     * Discord webhook told of every new report, so Dily answers within 24 h
     * (App Store guideline 1.2). Without it, reports only reach the logs.
     */
    MODERATION_DISCORD_WEBHOOK_URL: optional(z.url()),
  })
  .refine(
    (env) => !(env.NODE_ENV === "production" && env.OTP_SENDER === "console"),
    {
      message: "OTP_SENDER=console is refused in production",
      path: ["OTP_SENDER"],
    },
  )
  .refine(
    (env) =>
      !(env.NODE_ENV === "production" && env.PAYMENT_GATEWAY === "simulated"),
    {
      message: "PAYMENT_GATEWAY=simulated is refused in production",
      path: ["PAYMENT_GATEWAY"],
    },
  )
  .refine(
    (env) => env.TEST_PHONES.length === 0 || env.TEST_PHONE_CODE !== undefined,
    {
      message: "TEST_PHONE_CODE is required with TEST_PHONES",
      path: ["TEST_PHONE_CODE"],
    },
  )
  .refine((env) => env.OTP_SENDER !== "none" || env.TEST_PHONES.length > 0, {
    message: "OTP_SENDER=none without TEST_PHONES: nobody could sign in",
    path: ["TEST_PHONES"],
  })
  .refine(
    (env) =>
      env.OTP_SENDER !== "whatsapp" ||
      (env.WHATSAPP_PHONE_NUMBER_ID !== undefined &&
        env.WHATSAPP_ACCESS_TOKEN !== undefined),
    {
      message:
        "OTP_SENDER=whatsapp needs WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN",
      path: ["OTP_SENDER"],
    },
  );

export type Config = z.infer<typeof envSchema>;

/** Reads and validates the configuration; fails at startup when a variable is wrong. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
