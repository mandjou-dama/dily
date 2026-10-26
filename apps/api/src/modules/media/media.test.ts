import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  IMAGE_VARIANTS,
  MAX_IMAGE_UPLOAD_BYTES,
  type Profile,
} from "@dily/shared";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, testPhoto, type TestApp } from "../../../test/app.js";
import {
  createTestPrisma,
  createTestRedis,
  hasTestServices,
  resetState,
} from "../../../test/db.js";

describe.skipIf(!hasTestServices)("media", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  let token: string;
  let userId: string;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    ({ accessToken: token, userId } = await t.login());
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  const sizeOf = async (key: string) =>
    sharp(await readFile(join(t.mediaDir, key))).metadata();

  it("stores every size as WebP under the user's folder, served under /media", async () => {
    const res = await t.upload(
      token,
      "/media/product-images",
      await testPhoto(2000, 1500),
    );
    expect(res.statusCode).toBe(201);
    const { path } = res.json<{ path: string }>();
    expect(path).toMatch(new RegExp(`^products/${userId}/[0-9a-f-]{36}$`));

    const sm = await sizeOf(`${path}-sm.webp`);
    expect(sm).toMatchObject({
      format: "webp",
      width: IMAGE_VARIANTS.sm,
      height: 300,
    });
    const lg = await sizeOf(`${path}-lg.webp`);
    expect(lg).toMatchObject({ width: IMAGE_VARIANTS.lg, height: 900 });

    const served = await t.app.inject({
      method: "GET",
      url: `/media/${path}-sm.webp`,
    });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/webp");
  });

  it("never enlarges a small image", async () => {
    const res = await t.upload(
      token,
      "/media/product-images",
      await testPhoto(300, 200),
    );
    const { path } = res.json<{ path: string }>();
    expect(await sizeOf(`${path}-lg.webp`)).toMatchObject({
      width: 300,
      height: 200,
    });
  });

  it("refuses what isn't an image, and files too large", async () => {
    const text = await t.upload(
      token,
      "/media/product-images",
      Buffer.from("hello"),
    );
    expect(text.statusCode).toBe(415);
    expect(text.json().error).toBe("unsupported_image");

    const huge = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1);
    const tooLarge = await t.upload(token, "/media/product-images", huge);
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.json().error).toBe("file_too_large");
  });

  it("requires sign-in to upload", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/media/product-images",
    });
    expect(res.statusCode).toBe(401);
  });

  it("replaces the avatar and deletes the previous one", async () => {
    const first = (
      await t.upload(token, "/me/avatar", await testPhoto())
    ).json<Profile>();
    expect(first.avatarPath).toMatch(new RegExp(`^avatars/${userId}/`));
    const second = (
      await t.upload(token, "/me/avatar", await testPhoto())
    ).json<Profile>();
    expect(second.avatarPath).not.toBe(first.avatarPath);

    const old = await t.app.inject({
      method: "GET",
      url: `/media/${first.avatarPath}-sm.webp`,
    });
    expect(old.statusCode).toBe(404);
  });

  it("updates the name and neighbourhood; blank clears the neighbourhood", async () => {
    const patch = (payload: object) =>
      t.authed(token, { method: "PATCH", url: "/me", payload });
    const named = await patch({
      fullName: "  Awa Diarra ",
      neighbourhood: "Badalabougou",
    });
    expect(named.json()).toMatchObject({
      fullName: "Awa Diarra",
      neighbourhood: "Badalabougou",
    });

    const cleared = await patch({ fullName: "Awa Diarra", neighbourhood: "" });
    expect(cleared.json().neighbourhood).toBeNull();
    expect((await patch({ fullName: "" })).statusCode).toBe(400);
  });
});
