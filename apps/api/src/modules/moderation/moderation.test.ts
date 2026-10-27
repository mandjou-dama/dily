import type {
  AcceptedOffer,
  ApiError,
  BlockedUsers,
  ChatMessage,
  Conversation,
  FeedPage,
  FeedProduct,
  OrderDetails,
  Payment,
  ReportBody,
} from "@dily/shared";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
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
import type { EmitToUser } from "../realtime/notifier.js";
import { REPORT_RATE_LIMIT } from "./moderation.service.js";

const SELLER_PHONE = "+22370000001";

describe.skipIf(!hasTestServices)("moderation", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  type TestUser = { id: string; token: string };
  let seller: TestUser;
  let buyer: TestUser;
  let outsider: TestUser;
  let categoryId: number;
  let events: MockInstance<EmitToUser>;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    const signIn = async (phone: `+223${string}`, fullName: string) => {
      const session = await t.login(phone);
      await prisma.user.update({
        where: { id: session.userId },
        data: { fullName, neighbourhood: "Badalabougou" },
      });
      return { id: session.userId, token: session.accessToken };
    };
    seller = await signIn(SELLER_PHONE, "Mamadou Diallo");
    buyer = await signIn("+22370000002", "Awa Diarra");
    outsider = await signIn("+22370000003", "Ali Touré");
    categoryId = (await createCategory(prisma)).id;
    events = vi.spyOn(t.services.notifier, "send");
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Nike Air Force 1 at 17 200 F, liked once so it can be a pick. */
  const createListing = (sellerId = seller.id) =>
    prisma.product.create({
      data: {
        sellerId,
        categoryId,
        title: "Nike Air Force 1",
        price: 17200,
        deliveryFee: 1500,
        likesCount: 1,
        images: { create: [{ path: "https://example.test/1.jpg" }] },
      },
    });

  const get = <T>(token: string, url: string) =>
    t.authed(token, { method: "GET", url }).then((res) => {
      expect(res.statusCode, res.body).toBe(200);
      return res.json<T>();
    });

  const post = (token: string, url: string, payload?: object) =>
    t.authed(token, { method: "POST", url, ...(payload ? { payload } : {}) });

  const report = (token: string, body: ReportBody) =>
    post(token, "/reports", body);

  const block = (token: string, userId: string) =>
    t.authed(token, { method: "PUT", url: `/me/blocks/${userId}` });

  const unblock = (token: string, userId: string) =>
    t.authed(token, { method: "DELETE", url: `/me/blocks/${userId}` });

  const openConversation = async (productId: string) => {
    const res = await post(buyer.token, "/conversations", { productId });
    expect(res.statusCode, res.body).toBe(200);
    return res.json<Conversation>();
  };

  const feedIds = async (token: string) =>
    (await get<FeedPage>(token, "/products")).items.map((p) => p.id);

  const pickIds = async (token: string) =>
    (await get<FeedProduct[]>(token, "/products/picks")).map((p) => p.id);

  /** The buyer offers 16 000 F for pickup, the seller accepts. */
  const agree = async (conversationId: string) => {
    const offer = (
      await post(buyer.token, `/conversations/${conversationId}/offers`, {
        id: randomUUID(),
        amount: 16000,
        fulfilment: "pickup",
      })
    ).json<ChatMessage>();
    const res = await post(
      seller.token,
      `/offers/${offer.offer?.id as string}/accept`,
    );
    expect(res.statusCode, res.body).toBe(200);
    return res.json<AcceptedOffer>().order;
  };

  const pay = (orderId: string) =>
    post(buyer.token, `/orders/${orderId}/payments`, {
      id: randomUUID(),
      provider: "orange_money",
      payerPhone: "+22370000002",
    });

  describe("reports", () => {
    it("records a listing report against its seller, once while it's open", async () => {
      const listing = await createListing();
      const body: ReportBody = {
        kind: "listing",
        productId: listing.id,
        reason: "counterfeit",
        note: "  Le logo n'est pas le bon  ",
      };
      expect((await report(buyer.token, body)).statusCode).toBe(204);
      expect((await report(buyer.token, body)).statusCode).toBe(204);

      const reports = await prisma.report.findMany();
      expect(reports).toEqual([
        expect.objectContaining({
          kind: "listing",
          reporterId: buyer.id,
          reportedUserId: seller.id,
          productId: listing.id,
          conversationId: null,
          reason: "counterfeit",
          note: "Le logo n'est pas le bon",
          status: "open",
        }),
      ]);
    });

    it("tells Dily once per report, with what to look at", async () => {
      const listing = await createListing();
      const body: ReportBody = {
        kind: "listing",
        productId: listing.id,
        reason: "counterfeit",
        note: "Faux logo",
      };
      await report(buyer.token, body);
      await report(buyer.token, body);

      await vi.waitFor(() => expect(t.reportAlerts.alerts).toHaveLength(1));
      const reportId = (await prisma.report.findFirstOrThrow()).id;
      expect(t.reportAlerts.alerts[0]).toEqual({
        reportId,
        kind: "listing",
        reason: "counterfeit",
        note: "Faux logo",
        reportedName: "Mamadou Diallo",
        openReports: 1,
        reporterName: "Awa Diarra",
        listingTitle: "Nike Air Force 1",
        conversationId: null,
      });
    });

    it("records a person reported from a conversation", async () => {
      const listing = await createListing();
      const conversation = await openConversation(listing.id);

      const res = await report(seller.token, {
        kind: "user",
        conversationId: conversation.id,
        reason: "harassment",
      });
      expect(res.statusCode, res.body).toBe(204);
      expect(await prisma.report.findFirstOrThrow()).toMatchObject({
        kind: "user",
        reporterId: seller.id,
        reportedUserId: buyer.id,
        productId: null,
        conversationId: conversation.id,
        note: null,
      });
    });

    it("refuses one's own listing, others' conversations and wrong reasons", async () => {
      const listing = await createListing();
      const conversation = await openConversation(listing.id);

      const own = await report(seller.token, {
        kind: "listing",
        productId: listing.id,
        reason: "scam",
      });
      expect(own.statusCode).toBe(403);
      const elsewhere = await report(outsider.token, {
        kind: "user",
        conversationId: conversation.id,
        reason: "scam",
      });
      expect(elsewhere.statusCode).toBe(404);
      const wrongReason = await report(buyer.token, {
        kind: "user",
        conversationId: conversation.id,
        reason: "counterfeit" as "scam",
      });
      expect(wrongReason.statusCode).toBe(400);
      expect(await prisma.report.count()).toBe(0);
    });

    it("limits how many reports one person sends", async () => {
      const listings = await Promise.all(
        Array.from({ length: REPORT_RATE_LIMIT.max + 1 }, () =>
          createListing(),
        ),
      );
      const codes = [];
      for (const listing of listings) {
        const res = await report(buyer.token, {
          kind: "listing",
          productId: listing.id,
          reason: "spam",
        });
        codes.push(res.statusCode);
      }
      expect(codes.at(-1)).toBe(429);
      expect(await prisma.report.count()).toBe(REPORT_RATE_LIMIT.max);
    });
  });

  describe("blocks", () => {
    it("hides each one's listings from the other, both ways, until unblocked", async () => {
      const sellers = await createListing();
      const buyers = await createListing(buyer.id);
      const conversation = await openConversation(sellers.id);
      await t.authed(buyer.token, {
        method: "PUT",
        url: `/products/${sellers.id}/like`,
      });

      expect((await block(seller.token, buyer.id)).statusCode).toBe(204);

      expect(await feedIds(buyer.token)).toEqual([buyers.id]);
      expect(await feedIds(seller.token)).toEqual([sellers.id]);
      expect(await feedIds(outsider.token)).toHaveLength(2);
      expect(await pickIds(buyer.token)).toEqual([buyers.id]);
      const details = await t.authed(buyer.token, {
        method: "GET",
        url: `/products/${sellers.id}`,
      });
      expect(details.statusCode).toBe(404);
      expect((await get<FeedPage>(buyer.token, "/me/favorites")).items).toEqual(
        [],
      );
      // The conversation stays, closed
      expect(
        await get<Conversation>(
          seller.token,
          `/conversations/${conversation.id}`,
        ),
      ).toMatchObject({ blockedByMe: true, canWrite: false });
      expect(
        await get<Conversation>(
          buyer.token,
          `/conversations/${conversation.id}`,
        ),
      ).toMatchObject({ blockedByMe: false, canWrite: false });

      expect((await unblock(seller.token, buyer.id)).statusCode).toBe(204);
      expect(await feedIds(buyer.token)).toHaveLength(2);
      expect(
        await get<Conversation>(
          buyer.token,
          `/conversations/${conversation.id}`,
        ),
      ).toMatchObject({ blockedByMe: false, canWrite: true });
    });

    it("stops messages, offers, buys and new conversations between the two", async () => {
      const listing = await createListing();
      const other = await createListing();
      const conversation = await openConversation(listing.id);
      await block(buyer.token, seller.id);

      const refused = await Promise.all([
        post(seller.token, `/conversations/${conversation.id}/messages`, {
          id: randomUUID(),
          body: "Toujours là ?",
        }),
        post(buyer.token, `/conversations/${conversation.id}/messages`, {
          id: randomUUID(),
          body: "Bonjour",
        }),
        post(buyer.token, `/conversations/${conversation.id}/offers`, {
          id: randomUUID(),
          amount: 16000,
          fulfilment: "pickup",
        }),
        post(buyer.token, "/orders", {
          conversationId: conversation.id,
          fulfilment: "pickup",
        }),
      ]);
      for (const res of refused) {
        expect(res.statusCode, res.body).toBe(403);
        expect(res.json<ApiError>().error).toBe("blocked");
      }
      // Hidden listings can't start a conversation
      const fresh = await post(buyer.token, "/conversations", {
        productId: other.id,
      });
      expect(fresh.statusCode).toBe(404);
      expect(await prisma.message.count()).toBe(0);
    });

    it("refuses accepting an offer made before the block", async () => {
      const listing = await createListing();
      const conversation = await openConversation(listing.id);
      const offer = (
        await post(buyer.token, `/conversations/${conversation.id}/offers`, {
          id: randomUUID(),
          amount: 16000,
          fulfilment: "pickup",
        })
      ).json<ChatMessage>();
      await block(buyer.token, seller.id);

      const res = await post(
        seller.token,
        `/offers/${offer.offer?.id as string}/accept`,
      );
      expect(res.statusCode).toBe(403);
      expect(res.json<ApiError>().error).toBe("blocked");
    });

    it("ends an agreement not paid yet, freeing the listing", async () => {
      const listing = await createListing();
      const conversation = await openConversation(listing.id);
      const order = await agree(conversation.id);
      events.mockClear();

      await block(seller.token, buyer.id);

      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ).toMatchObject({ status: "cancelled" });
      for (const id of [buyer.id, seller.id]) {
        expect(events).toHaveBeenCalledWith(id, "order:updated", {
          order: expect.objectContaining({
            id: order.id,
            status: "cancelled",
          }),
        });
      }
      const payment = await pay(order.id);
      expect(payment.statusCode).toBe(403);
    });

    it("lets a paid order go to its end", async () => {
      const listing = await createListing();
      const conversation = await openConversation(listing.id);
      const order = await agree(conversation.id);
      const payment = (await pay(order.id)).json<Payment>();
      await t.payments.answer(payment.id, {
        status: "succeeded",
        reference: "OM-0001",
      });

      await block(buyer.token, seller.id);

      const { handoverCode } = await get<OrderDetails>(
        buyer.token,
        `/orders/${order.id}`,
      );
      const res = await post(seller.token, `/orders/${order.id}/handover`, {
        code: handoverCode,
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ).toMatchObject({ status: "completed" });
    });

    it("lists the people blocked, the latest first", async () => {
      await block(buyer.token, seller.id);
      t.advance(60);
      await block(buyer.token, outsider.id);
      // Blocking again changes nothing
      expect((await block(buyer.token, seller.id)).statusCode).toBe(204);

      const { items } = await get<BlockedUsers>(buyer.token, "/me/blocks");
      expect(items.map((u) => [u.id, u.name])).toEqual([
        [outsider.id, "Ali Touré"],
        [seller.id, "Mamadou Diallo"],
      ]);
      expect(await get<BlockedUsers>(seller.token, "/me/blocks")).toEqual({
        items: [],
      });
    });

    it("refuses blocking oneself or someone who doesn't exist", async () => {
      expect((await block(buyer.token, buyer.id)).statusCode).toBe(400);
      expect((await block(buyer.token, randomUUID())).statusCode).toBe(404);
    });
  });

  describe("Dily's decisions", () => {
    const listingReport = async (
      productId: string,
      token = buyer.token,
    ): Promise<string> => {
      await report(token, { kind: "listing", productId, reason: "scam" });
      const row = await prisma.report.findFirstOrThrow({
        where: { productId, reporterId: { not: null } },
        orderBy: { createdAt: "desc" },
      });
      return row.id;
    };

    it("removes a listing for everyone but its seller, who can't relist it", async () => {
      const listing = await createListing();
      const reportId = await listingReport(listing.id);
      await listingReport(listing.id, outsider.token);

      await t.services.moderation.resolveReport(reportId, "remove");

      expect(await feedIds(buyer.token)).toEqual([]);
      const forBuyer = await t.authed(buyer.token, {
        method: "GET",
        url: `/products/${listing.id}`,
      });
      expect(forBuyer.statusCode).toBe(404);
      const forSeller = await get<{ status: string }>(
        seller.token,
        `/products/${listing.id}`,
      );
      expect(forSeller.status).toBe("archived");
      const relist = await t.authed(seller.token, {
        method: "PATCH",
        url: `/listings/${listing.id}/status`,
        payload: { sold: false },
      });
      expect(relist.statusCode).toBe(404);
      // Both reports answered at once
      expect(
        (await prisma.report.findMany()).map((r) => r.status).sort(),
      ).toEqual(["actioned", "actioned"]);
      await expect(
        t.services.moderation.resolveReport(reportId, "dismiss"),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("suspends an account: signed out, can't sign in, listings hidden", async () => {
      const listing = await createListing();
      const reportId = await listingReport(listing.id);

      await t.services.moderation.resolveReport(reportId, "suspend");

      const me = await t.authed(seller.token, { method: "GET", url: "/me" });
      expect(me.statusCode).toBe(401);
      await t.app.inject({
        method: "POST",
        url: "/auth/otp/request",
        payload: { phone: SELLER_PHONE },
      });
      const signIn = await t.app.inject({
        method: "POST",
        url: "/auth/otp/verify",
        payload: {
          phone: SELLER_PHONE,
          code: t.otp.lastCodeFor(SELLER_PHONE),
          deviceId: "device-test-0001",
        },
      });
      expect(signIn.statusCode).toBe(403);
      expect(signIn.json<ApiError>().error).toBe("account_suspended");
      expect(await feedIds(buyer.token)).toEqual([]);
      expect(
        await prisma.refreshToken.count({
          where: { userId: seller.id, revokedAt: null },
        }),
      ).toBe(0);
      expect(
        await prisma.report.findUniqueOrThrow({ where: { id: reportId } }),
      ).toMatchObject({ status: "actioned" });
    });

    it("dismisses a report without touching anything", async () => {
      const listing = await createListing();
      const reportId = await listingReport(listing.id);

      await t.services.moderation.resolveReport(reportId, "dismiss");

      expect(await feedIds(buyer.token)).toEqual([listing.id]);
      expect(
        await prisma.report.findUniqueOrThrow({ where: { id: reportId } }),
      ).toMatchObject({ status: "dismissed" });
    });
  });
});
