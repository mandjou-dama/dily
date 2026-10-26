import { FEED_PAGE_SIZE, type FeedPage, type FeedProduct } from "@dily/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategory,
  createTestApp,
  type TestApp,
} from "../../../test/app.js";
import {
  createTestPrisma,
  createTestRedis,
  hasTestServices,
  resetState,
} from "../../../test/db.js";

describe.skipIf(!hasTestServices)("products", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  let token: string;
  let sellerId: string;
  let categoryId: number;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    const seller = await t.login("+22370000009");
    sellerId = seller.userId;
    token = (await t.login("+22370000001")).accessToken;
    categoryId = (await createCategory(prisma, "shoes")).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Lists products directly, `minutesAgo` apart so the feed order is known. */
  const createProducts = (
    titles: string[],
    extra: { status?: "sold" | "archived" } = {},
  ) =>
    Promise.all(
      titles.map((title, i) =>
        prisma.product.create({
          data: {
            sellerId,
            categoryId,
            title,
            price: 1000,
            createdAt: new Date(Date.now() - i * 60_000),
            images: {
              create: [{ path: `https://example.test/${i}.jpg`, position: 0 }],
            },
            ...extra,
          },
        }),
      ),
    );

  const feed = async (query = "") =>
    (
      await t.authed(token, { method: "GET", url: `/products${query}` })
    ).json<FeedPage>();

  it("pages through active listings newest first, without duplicates", async () => {
    const titles = Array.from(
      { length: FEED_PAGE_SIZE + 5 },
      (_, i) => `Item ${i}`,
    );
    await createProducts(titles);
    await createProducts(["Sold one"], { status: "sold" });

    const first = await feed();
    expect(first.items).toHaveLength(FEED_PAGE_SIZE);
    expect(first.items[0]?.title).toBe("Item 0");
    expect(first.nextCursor).not.toBeNull();

    const second = await feed(`?cursor=${first.nextCursor}`);
    expect(second.items.map((p) => p.title)).toEqual(
      titles.slice(FEED_PAGE_SIZE),
    );
    expect(second.nextCursor).toBeNull();
  });

  it("filters by category and searches titles, wildcards taken literally", async () => {
    await createProducts([
      "Nike Air Force 1",
      "Canvas sneakers",
      "50% off bag",
    ]);
    const bags = await createCategory(prisma, "bags");
    await prisma.product.create({
      data: { sellerId, categoryId: bags.id, title: "Tote", price: 1 },
    });

    expect((await feed("?search=nike")).items.map((p) => p.title)).toEqual([
      "Nike Air Force 1",
    ]);
    expect((await feed("?search=50%25")).items.map((p) => p.title)).toEqual([
      "50% off bag",
    ]);
    expect((await feed("?search=_")).items).toHaveLength(0);
    expect((await feed("?category=bags")).items.map((p) => p.title)).toEqual([
      "Tote",
    ]);
  });

  it("refuses a malformed cursor", async () => {
    const res = await t.authed(token, {
      method: "GET",
      url: "/products?cursor=nope",
    });
    expect(res.statusCode).toBe(400);
  });

  it("hides archived listings from everyone but their seller", async () => {
    const [archived] = await createProducts(["Hidden"], { status: "archived" });
    const url = `/products/${archived?.id}`;
    expect((await t.authed(token, { method: "GET", url })).statusCode).toBe(
      404,
    );

    const seller = await t.login("+22370000009", "device-test-0002");
    const own = await t.authed(seller.accessToken, { method: "GET", url });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ title: "Hidden", status: "archived" });
  });

  it("counts likes once per user, through the trigger", async () => {
    const [product] = await createProducts(["Liked"]);
    const url = `/products/${product?.id}/like`;
    expect((await t.authed(token, { method: "PUT", url })).statusCode).toBe(
      204,
    );
    // Liking twice changes nothing
    await t.authed(token, { method: "PUT", url });
    const other = await t.login("+22370000002");
    await t.authed(other.accessToken, { method: "PUT", url });

    const detail = await t.authed(token, {
      method: "GET",
      url: `/products/${product?.id}`,
    });
    expect(detail.json().likesCount).toBe(2);
    const liked = await t.authed(token, { method: "GET", url: "/me/likes" });
    expect(liked.json()).toEqual({ productIds: [product?.id] });

    await t.authed(token, { method: "DELETE", url });
    const after = await t.authed(token, {
      method: "GET",
      url: `/products/${product?.id}`,
    });
    expect(after.json().likesCount).toBe(1);
  });

  it("can't like an archived listing", async () => {
    const [archived] = await createProducts(["Hidden"], { status: "archived" });
    const res = await t.authed(token, {
      method: "PUT",
      url: `/products/${archived?.id}/like`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("picks the most liked listings that have a photo", async () => {
    const [a, b] = await createProducts([
      "Popular",
      "Less popular",
      "Not liked",
    ]);
    await prisma.product.update({
      where: { id: a!.id },
      data: { likesCount: 9 },
    });
    await prisma.product.update({
      where: { id: b!.id },
      data: { likesCount: 3 },
    });

    const res = await t.authed(token, {
      method: "GET",
      url: "/products/picks",
    });
    expect(res.json<FeedProduct[]>().map((p) => p.title)).toEqual([
      "Popular",
      "Less popular",
    ]);
  });
});
