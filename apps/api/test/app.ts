import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OtpVerifyResponse, PhoneE164 } from "@dily/shared";
import Fastify, { type InjectOptions } from "fastify";
import type { Redis } from "ioredis";
import sharp from "sharp";
import { buildApp } from "../src/app.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { OtpSender } from "../src/modules/auth/otp-sender.js";
import type {
  PushMessage,
  PushResult,
  PushSender,
} from "../src/modules/notifications/push.service.js";
import { attachRealtime } from "../src/modules/realtime/realtime.js";
import { createServices } from "../src/services.js";

/** Captures sent codes so tests can read the code received. */
export class FakeOtpSender implements OtpSender {
  readonly sent: { to: PhoneE164; code: string }[] = [];

  async send(to: PhoneE164, code: string): Promise<void> {
    this.sent.push({ to, code });
  }

  lastCodeFor(phone: PhoneE164): string {
    const last = this.sent.findLast((message) => message.to === phone);
    if (!last) throw new Error(`No code sent to ${phone}`);
    return last.code;
  }
}

/** Captures push notifications; tokens in `unregistered` answer DeviceNotRegistered. */
export class FakePushSender implements PushSender {
  readonly sent: (PushMessage & { to: string })[] = [];
  readonly unregistered = new Set<string>();

  async send(
    messages: (PushMessage & { to: string })[],
  ): Promise<PushResult[]> {
    this.sent.push(...messages);
    return messages.map((m) =>
      this.unregistered.has(m.to)
        ? { ok: false, deviceNotRegistered: true }
        : { ok: true },
    );
  }
}

/** Full app on the test Postgres and Redis, with captured codes and a controllable clock. */
export async function createTestApp(
  prisma: PrismaClient,
  redis: Redis,
  options: { testPhones?: PhoneE164[]; testPhoneCode?: string } = {},
) {
  const otp = new FakeOtpSender();
  const push = new FakePushSender();
  const mediaDir = await mkdtemp(join(tmpdir(), "dily-media-"));
  let now = new Date();
  const services = createServices({
    config: {
      PHONE_HASH_PEPPER: "test-pepper-long-enough-0000000000000",
      JWT_ACCESS_SECRET: "j".repeat(32),
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 90 * 24 * 3600,
      OTP_SENDER: "console",
      TEST_PHONES: options.testPhones ?? [],
      TEST_PHONE_CODE: options.testPhoneCode,
      WHATSAPP_API_BASE: "https://whatsapp.test",
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_TEMPLATE_NAME: "dily_login_code",
      WHATSAPP_TEMPLATE_LANGUAGE: "fr",
      MEDIA_DIR: mediaDir,
      EXPO_ACCESS_TOKEN: undefined,
    },
    prisma,
    redis,
    logger: Fastify().log,
    otpSender: otp,
    pushSender: push,
    now: () => now,
  });
  const app = buildApp(services);
  // As in server.ts: before the app starts, which the first request does
  const realtime = attachRealtime(app, { authenticate: services.authenticate });
  services.notifier.bind(realtime.emitToUser);

  return {
    app,
    services,
    otp,
    push,
    mediaDir,
    /** Listens on a free port, for Socket.IO clients; returns the server's URL. */
    async listen() {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (!address || typeof address === "string")
        throw new Error("Unexpected server address");
      return `http://127.0.0.1:${address.port}`;
    },
    advance: (seconds: number) => {
      now = new Date(now.getTime() + seconds * 1000);
    },
    /** Whole flow: code request, check, tokens. */
    async login(
      phone: PhoneE164 = "+22370000001",
      deviceId = "device-test-0001",
    ) {
      await app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phone },
      });
      const res = await app.inject({
        method: "POST",
        url: "/auth/otp/verify",
        payload: { phone, code: otp.lastCodeFor(phone), deviceId },
      });
      if (res.statusCode !== 200)
        throw new Error(`Sign-in failed: ${res.body}`);
      return res.json<OtpVerifyResponse>();
    },
    /** Request authenticated with the given access JWT. */
    authed(accessToken: string, options: InjectOptions) {
      return app.inject({
        ...options,
        headers: { ...options.headers, authorization: `Bearer ${accessToken}` },
      });
    },
    /** Uploads an image as multipart, the way the app does. */
    async upload(
      accessToken: string,
      url: string,
      image: Buffer,
      type = "image/jpeg",
    ) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(image)], { type }),
        "photo.jpg",
      );
      const encoded = new Response(form);
      return app.inject({
        method: url === "/me/avatar" ? "PUT" : "POST",
        url,
        payload: Buffer.from(await encoded.arrayBuffer()),
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": encoded.headers.get("content-type") ?? "",
        },
      });
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** A JPEG photo of the given size. */
export const testPhoto = (width = 2000, height = 1500) =>
  sharp({ create: { width, height, channels: 3, background: "#c0392b" } })
    .jpeg()
    .toBuffer();

/** A category to list products in. */
export const createCategory = (prisma: PrismaClient, slug = "shoes") =>
  prisma.category.create({ data: { slug, name: slug, position: 1 } });
