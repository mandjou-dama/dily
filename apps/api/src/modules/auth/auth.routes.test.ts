import type { AuthTokens } from "@dily/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../../test/app.js";
import {
  createTestPrisma,
  createTestRedis,
  hasTestServices,
  resetState,
} from "../../../test/db.js";
import { REFRESH_REUSE_GRACE_SECONDS } from "./auth.service.js";

describe.skipIf(!hasTestServices)("auth", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis, {
      testPhones: ["+22370000000"],
      testPhoneCode: "123456",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  const refresh = (refreshToken: string) =>
    t.app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });

  it("signs in with the code sent, creating the account once", async () => {
    const first = await t.login("+22370000001");
    expect(first.isNewUser).toBe(true);
    const me = await t.authed(first.accessToken, { method: "GET", url: "/me" });
    expect(me.json()).toMatchObject({
      id: first.userId,
      phone: "+22370000001",
      fullName: null,
    });

    const again = await t.login("+22370000001", "device-test-0002");
    expect(again).toMatchObject({ userId: first.userId, isNewUser: false });
  });

  it("refuses a wrong code, then locks the code after 5 attempts", async () => {
    const phone = "+22370000001";
    await t.app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phone },
    });
    const wrong = t.otp.lastCodeFor(phone) === "000000" ? "111111" : "000000";
    const verify = (code: string) =>
      t.app.inject({
        method: "POST",
        url: "/auth/otp/verify",
        payload: { phone, code, deviceId: "device-test-0001" },
      });

    for (let i = 0; i < 5; i++)
      expect((await verify(wrong)).json().error).toBe("otp_invalid");
    // Even the right code is refused once the attempts are spent
    const locked = await verify(t.otp.lastCodeFor(phone));
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error).toBe("otp_too_many_attempts");
  });

  it("never messages test numbers, which take the fixed code", async () => {
    await t.app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phone: "+22370000000" },
    });
    expect(t.otp.sent).toHaveLength(0);
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: {
        phone: "+22370000000",
        code: "123456",
        deviceId: "device-test-0001",
      },
    });
    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({
      where: { phoneE164: "+22370000000" },
    });
    expect(user.isTester).toBe(true);
  });

  it("limits code requests per number", async () => {
    const request = () =>
      t.app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phone: "+22370000001" },
      });
    for (let i = 0; i < 3; i++) expect((await request()).statusCode).toBe(204);
    const limited = await request();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(t.otp.sent).toHaveLength(3);
  });

  it("rejects a non-Malian number", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/otp/request",
      payload: { phone: "+33612345678" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rotates refresh tokens", async () => {
    const session = await t.login();
    const res = await refresh(session.refreshToken);
    expect(res.statusCode).toBe(200);
    const next = res.json<AuthTokens>();
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect((await refresh(next.refreshToken)).statusCode).toBe(200);
  });

  it("closes every session when a rotated token is reused after the grace delay", async () => {
    const session = await t.login();
    const next = (await refresh(session.refreshToken)).json<AuthTokens>();
    t.advance(REFRESH_REUSE_GRACE_SECONDS + 1);

    const reused = await refresh(session.refreshToken);
    expect(reused.statusCode).toBe(401);
    expect(reused.json().error).toBe("refresh_token_invalid");
    // The legitimate successor is revoked too
    expect((await refresh(next.refreshToken)).statusCode).toBe(401);
  });

  it("tolerates a refresh whose response was lost", async () => {
    const session = await t.login();
    await refresh(session.refreshToken);
    // Same token again within the grace delay: the client never got the answer
    expect((await refresh(session.refreshToken)).statusCode).toBe(200);
  });

  it("revokes the refresh token on logout", async () => {
    const session = await t.login();
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: session.refreshToken },
    });
    expect(res.statusCode).toBe(204);
    expect((await refresh(session.refreshToken)).statusCode).toBe(401);
  });

  it("refuses requests without a valid access token", async () => {
    expect((await t.app.inject({ method: "GET", url: "/me" })).statusCode).toBe(
      401,
    );
    const forged = await t.authed("not-a-jwt", {
      method: "GET",
      url: "/products",
    });
    expect(forged.statusCode).toBe(401);
  });
});
