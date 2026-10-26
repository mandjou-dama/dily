import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ListingBody } from "@dily/shared";
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

describe.skipIf(!hasTestServices)("sell", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  let seller: string;
  let other: string;
  let categoryId: number;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    seller = (await t.login("+22370000001")).accessToken;
    other = (await t.login("+22370000002")).accessToken;
    categoryId = (await createCategory(prisma)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  const upload = async (token: string) => {
    const res = await t.upload(
      token,
      "/media/product-images",
      await testPhoto(),
    );
    expect(res.statusCode).toBe(201);
    return res.json<{ path: string }>().path;
  };

  const listing = (imagePaths: string[]): ListingBody => ({
    title: "Nike Air Force 1",
    description: "Worn twice",
    price: 17200,
    categoryId,
    condition: "used",
    size: "42",
    imagePaths,
  });

  const create = async (token: string, body: ListingBody) =>
    t.authed(token, { method: "POST", url: "/listings", payload: body });

  const fileExists = (path: string) =>
    existsSync(join(t.mediaDir, `${path}-sm.webp`));

  it("publishes a listing with the seller's photos, in order", async () => {
    const photos = [await upload(seller), await upload(seller)];
    const res = await create(seller, listing(photos));
    expect(res.statusCode).toBe(201);

    const { id } = res.json<{ id: string }>();
    const detail = await t.authed(other, {
      method: "GET",
      url: `/products/${id}`,
    });
    expect(detail.json()).toMatchObject({
      title: "Nike Air Force 1",
      description: "Worn twice",
      price: 17200,
      imagePaths: photos,
    });
  });

  it("refuses photos uploaded by someone else", async () => {
    const theirs = await upload(other);
    const res = await create(seller, listing([theirs]));
    expect(res.statusCode).toBe(403);
    expect(await prisma.product.count()).toBe(0);
  });

  it("refuses a photo that already belongs to another listing", async () => {
    const photo = await upload(seller);
    expect((await create(seller, listing([photo]))).statusCode).toBe(201);
    expect((await create(seller, listing([photo]))).statusCode).toBe(400);
  });

  it("validates the listing", async () => {
    const photo = await upload(seller);
    const noPhotos = await create(seller, listing([]));
    expect(noPhotos.statusCode).toBe(400);
    const badCategory = await create(seller, {
      ...listing([photo]),
      categoryId: 999,
    });
    expect(badCategory.statusCode).toBe(400);
    const negative = await create(seller, { ...listing([photo]), price: -1 });
    expect(negative.statusCode).toBe(400);
  });

  it("lets only the seller edit, mark sold or delete", async () => {
    const { id } = (
      await create(seller, listing([await upload(seller)]))
    ).json<{ id: string }>();
    const theirPhoto = await upload(other);

    const edit = await t.authed(other, {
      method: "PUT",
      url: `/listings/${id}`,
      payload: { ...listing([theirPhoto]), title: "Mine now" },
    });
    expect(edit.statusCode).toBe(404);
    const sold = await t.authed(other, {
      method: "PATCH",
      url: `/listings/${id}/status`,
      payload: { sold: true },
    });
    expect(sold.statusCode).toBe(404);
    const del = await t.authed(other, {
      method: "DELETE",
      url: `/listings/${id}`,
    });
    expect(del.statusCode).toBe(404);

    const product = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(product).toMatchObject({
      title: "Nike Air Force 1",
      status: "active",
    });
  });

  it("replaces photos on edit and deletes the removed ones", async () => {
    const [kept, removed] = [await upload(seller), await upload(seller)];
    const { id } = (await create(seller, listing([kept, removed]))).json<{
      id: string;
    }>();
    const added = await upload(seller);

    const res = await t.authed(seller, {
      method: "PUT",
      url: `/listings/${id}`,
      payload: { ...listing([added, kept]), title: "Edited" },
    });
    expect(res.statusCode).toBe(204);

    const detail = await t.authed(seller, {
      method: "GET",
      url: `/products/${id}`,
    });
    expect(detail.json()).toMatchObject({
      title: "Edited",
      imagePaths: [added, kept],
    });
    expect(fileExists(removed)).toBe(false);
    expect(fileExists(kept)).toBe(true);
  });

  it("marks sold: out of the feed, still reachable", async () => {
    const { id } = (
      await create(seller, listing([await upload(seller)]))
    ).json<{ id: string }>();
    await t.authed(seller, {
      method: "PATCH",
      url: `/listings/${id}/status`,
      payload: { sold: true },
    });

    const feed = await t.authed(other, { method: "GET", url: "/products" });
    expect(feed.json().items).toHaveLength(0);
    const detail = await t.authed(other, {
      method: "GET",
      url: `/products/${id}`,
    });
    expect(detail.json().status).toBe("sold");
  });

  it("deletes the listing and its photo files", async () => {
    const photo = await upload(seller);
    const { id } = (await create(seller, listing([photo]))).json<{
      id: string;
    }>();
    const res = await t.authed(seller, {
      method: "DELETE",
      url: `/listings/${id}`,
    });
    expect(res.statusCode).toBe(204);
    expect(await prisma.product.count()).toBe(0);
    expect(fileExists(photo)).toBe(false);
  });

  it("discards only the caller's unused uploads", async () => {
    const [used, unused] = [await upload(seller), await upload(seller)];
    const theirs = await upload(other);
    await create(seller, listing([used]));

    const res = await t.authed(seller, {
      method: "DELETE",
      url: "/media/product-images",
      payload: { paths: [used, unused, theirs] },
    });
    expect(res.statusCode).toBe(204);
    expect(fileExists(used)).toBe(true);
    expect(fileExists(unused)).toBe(false);
    expect(fileExists(theirs)).toBe(true);
  });
});
