import { existsSync } from "node:fs";
import { join } from "node:path";
import { FEED_PAGE_SIZE, type FeedPage, type Profile } from "@dily/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategory,
  createTestApp,
  testPhoto,
  type TestApp,
} from "../../../test/app.js";
import {
  createTestPrisma,
  createTestRedis,
  hasTestServices,
  resetState,
} from "../../../test/db.js";

describe.skipIf(!hasTestServices)("profile tabs and account deletion", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  let me: { id: string; token: string; refreshToken: string };
  let other: { id: string; token: string };
  let categoryId: number;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    const mine = await t.login("+22370000001");
    me = {
      id: mine.userId,
      token: mine.accessToken,
      refreshToken: mine.refreshToken,
    };
    const theirs = await t.login("+22370000002");
    other = { id: theirs.userId, token: theirs.accessToken };
    categoryId = (await createCategory(prisma)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Lists products directly, `i` minutes apart so the order is known. */
  const createProducts = (
    sellerId: string,
    titles: string[],
    status: "active" | "sold" | "archived" = "active",
  ) =>
    Promise.all(
      titles.map((title, i) =>
        prisma.product.create({
          data: {
            sellerId,
            categoryId,
            title,
            price: 1000,
            status,
            createdAt: new Date(Date.now() - i * 60_000),
          },
        }),
      ),
    );

  const get = async (token: string, url: string) =>
    (await t.authed(token, { method: "GET", url })).json<FeedPage>();

  const like = (token: string, productId: string) =>
    t.authed(token, { method: "PUT", url: `/products/${productId}/like` });

  it("lists my listings, sold and archived included, and nobody else's", async () => {
    await createProducts(me.id, ["Active"]);
    await createProducts(me.id, ["Sold"], "sold");
    await createProducts(me.id, ["Archived"], "archived");
    await createProducts(other.id, ["Theirs"]);

    const page = await get(me.token, "/me/listings");
    expect(page.items.map((p) => [p.title, p.status]).sort()).toEqual([
      ["Active", "active"],
      ["Archived", "archived"],
      ["Sold", "sold"],
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("pages through my listings", async () => {
    const titles = Array.from(
      { length: FEED_PAGE_SIZE + 3 },
      (_, i) => `Item ${i}`,
    );
    await createProducts(me.id, titles);

    const first = await get(me.token, "/me/listings");
    const second = await get(
      me.token,
      `/me/listings?cursor=${first.nextCursor}`,
    );
    expect([...first.items, ...second.items].map((p) => p.title)).toEqual(
      titles,
    );
    expect(second.nextCursor).toBeNull();
  });

  it("lists favorites by latest like, hiding others' archived listings", async () => {
    const [first, second, archived] = await createProducts(other.id, [
      "Liked first",
      "Liked second",
      "Archived later",
    ]);
    const [own] = await createProducts(me.id, ["My own"], "archived");
    for (const product of [first, second, archived, own]) {
      await like(me.token, product!.id);
    }
    await prisma.product.update({
      where: { id: archived!.id },
      data: { status: "archived" },
    });

    const page = await get(me.token, "/me/favorites");
    expect(page.items.map((p) => p.title)).toEqual([
      "My own",
      "Liked second",
      "Liked first",
    ]);
  });

  it("pages through favorites without duplicates", async () => {
    const titles = Array.from(
      { length: FEED_PAGE_SIZE + 2 },
      (_, i) => `Fav ${i}`,
    );
    const products = await createProducts(other.id, titles);
    for (const product of products) await like(me.token, product.id);

    const first = await get(me.token, "/me/favorites");
    const second = await get(
      me.token,
      `/me/favorites?cursor=${first.nextCursor}`,
    );
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(titles.length);
    expect(second.nextCursor).toBeNull();
  });

  it("deletes the account, its listings, sessions, likes and images", async () => {
    // An avatar, a listing with a photo, and an upload never used
    const avatar = (
      await t.upload(me.token, "/me/avatar", await testPhoto())
    ).json<Profile>().avatarPath!;
    const upload = async () =>
      (
        await t.upload(me.token, "/media/product-images", await testPhoto())
      ).json<{ path: string }>().path;
    const [photo, abandoned] = [await upload(), await upload()];
    await t.authed(me.token, {
      method: "POST",
      url: "/listings",
      payload: {
        title: "Mine",
        description: "",
        price: 5000,
        categoryId,
        condition: "good",
        size: "",
        imagePaths: [photo],
      },
    });
    const [theirs] = await createProducts(other.id, ["Theirs"]);
    await like(me.token, theirs!.id);

    const res = await t.authed(me.token, { method: "DELETE", url: "/me" });
    expect(res.statusCode).toBe(204);

    expect(await prisma.user.count({ where: { id: me.id } })).toBe(0);
    expect(await prisma.product.count({ where: { sellerId: me.id } })).toBe(0);
    const liked = await prisma.product.findUniqueOrThrow({
      where: { id: theirs!.id },
    });
    expect(liked.likesCount).toBe(0);
    for (const path of [avatar, photo, abandoned]) {
      expect(existsSync(join(t.mediaDir, `${path}-sm.webp`))).toBe(false);
    }

    // Neither the access JWT nor the refresh token work anymore
    const after = await t.authed(me.token, { method: "GET", url: "/me" });
    expect(after.statusCode).toBe(401);
    const refresh = await t.app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: me.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);

    // The same number signs up again as a new account
    const again = await t.login("+22370000001", "device-test-0002");
    expect(again).toMatchObject({ isNewUser: true });
    expect(again.userId).not.toBe(me.id);
  });

  it("leaves other people's images alone", async () => {
    const theirPhoto = (
      await t.upload(other.token, "/media/product-images", await testPhoto())
    ).json<{ path: string }>().path;
    await t.authed(me.token, { method: "DELETE", url: "/me" });
    expect(existsSync(join(t.mediaDir, `${theirPhoto}-sm.webp`))).toBe(true);
  });
});
