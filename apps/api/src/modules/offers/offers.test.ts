import {
  type AcceptedOffer,
  type ChatMessage,
  type Conversation,
  type MessagePage,
  type Offer,
  type OfferBody,
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
  testPhoto,
  type TestApp,
} from "../../../test/app.js";
import {
  createTestPrisma,
  createTestRedis,
  hasTestServices,
  resetState,
} from "../../../test/db.js";
import type { EmitToUser } from "../realtime/notifier.js";

const SELLER_PUSH = "ExponentPushToken[seller-phone]";
const BUYER_PUSH = "ExponentPushToken[buyer-phone]";
const DAY = 24 * 3600;

describe.skipIf(!hasTestServices)("offers", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  type TestUser = { id: string; token: string; refreshToken: string };
  let seller: TestUser;
  let buyer: TestUser;
  let rival: TestUser;
  let outsider: TestUser;
  let categoryId: number;
  let events: MockInstance<EmitToUser>;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    const signIn = async (
      phone: `+223${string}`,
      fullName: string,
      neighbourhood: string,
      city = "Bamako",
    ) => {
      const session = await t.login(phone);
      await prisma.user.update({
        where: { id: session.userId },
        data: { fullName, neighbourhood, city },
      });
      return {
        id: session.userId,
        token: session.accessToken,
        refreshToken: session.refreshToken,
      };
    };
    seller = await signIn("+22370000001", "Mamadou Diallo", "Badalabougou");
    buyer = await signIn("+22370000002", "Awa Diarra", "Hamdallaye ACI");
    rival = await signIn("+22370000003", "Fanta Keita", "Lafiabougou");
    outsider = await signIn("+22370000004", "Ali Touré", "Sogoniko");
    categoryId = (await createCategory(prisma)).id;
    events = vi.spyOn(t.services.notifier, "send");
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Nike Air Force 1 at 17 200 F, pickup in Badalabougou or delivery for 1 500 F. */
  const createListing = (
    fulfilment: { pickup?: boolean; deliveryFee?: number | null } = {},
  ) =>
    prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        title: "Nike Air Force 1",
        price: 17200,
        pickup: fulfilment.pickup ?? true,
        deliveryFee:
          fulfilment.deliveryFee === undefined ? 1500 : fulfilment.deliveryFee,
        images: { create: [{ path: "https://example.test/1.jpg" }] },
      },
    });

  const openConversation = async (token: string, productId: string) =>
    (
      await t.authed(token, {
        method: "POST",
        url: "/conversations",
        payload: { productId },
      })
    ).json<Conversation>();

  /**
   * Moves the clock on; access tokens last 15 minutes, so everyone gets
   * fresh ones, as the app would.
   */
  const later = async (seconds: number) => {
    t.advance(seconds);
    for (const user of [seller, buyer, rival, outsider]) {
      const res = await t.app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: user.refreshToken },
      });
      const tokens = res.json<{ accessToken: string; refreshToken: string }>();
      user.token = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
    }
  };

  // Each action a second after the previous one: offers and messages of a
  // conversation are told apart by time, as in real use
  const offer = (
    token: string,
    conversationId: string,
    body: Partial<OfferBody> & { amount: number },
  ) => {
    t.advance(1);
    return t.authed(token, {
      method: "POST",
      url: `/conversations/${conversationId}/offers`,
      payload: { id: randomUUID(), fulfilment: "pickup", ...body },
    });
  };

  /** An offer that must go through: its message. */
  const offered = async (
    token: string,
    conversationId: string,
    body: Partial<OfferBody> & { amount: number },
  ) => {
    const res = await offer(token, conversationId, body);
    expect(res.statusCode, res.body).toBe(201);
    return res.json<ChatMessage>();
  };

  const answer = (
    token: string,
    offerId: string,
    verb: "accept" | "decline",
  ) => {
    t.advance(1);
    return t.authed(token, {
      method: "POST",
      url: `/offers/${offerId}/${verb}`,
    });
  };

  const get = async <T>(token: string, url: string) =>
    (await t.authed(token, { method: "GET", url })).json<T>();

  const conversationFor = (token: string, id: string) =>
    get<Conversation>(token, `/conversations/${id}`);

  const messagesOf = async (token: string, id: string) =>
    (await get<MessagePage>(token, `/conversations/${id}/messages`)).items;

  const registerPushToken = (token: string, pushToken: string) =>
    t.authed(token, {
      method: "PUT",
      url: "/me/push-token",
      payload: { token: pushToken, platform: "ios" },
    });

  /** Events sent to a user, by name. */
  const sentTo = (userId: string, event: string) =>
    events.mock.calls
      .filter(([to, name]) => to === userId && name === event)
      .map(([, , payload]) => payload);

  describe("making an offer", () => {
    it("sends the buyer's delivered total as a message, with the listing's fee", async () => {
      await registerPushToken(seller.token, SELLER_PUSH);
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);

      const message = await offered(buyer.token, conversation.id, {
        amount: 17200,
        fulfilment: "delivery",
        deliveryArea: "Hamdallaye ACI",
      });
      expect(message).toMatchObject({
        senderId: buyer.id,
        kind: "offer",
        body: "Offre : 17 200 F, livraison comprise",
        order: null,
        offer: {
          authorId: buyer.id,
          amount: 17200,
          fulfilment: "delivery",
          deliveryFee: 1500,
          deliveryArea: "Hamdallaye ACI",
          listPrice: 17200,
          status: "pending",
          respondedAt: null,
        },
      });
      const offerValue = message.offer as Offer;
      expect(
        new Date(offerValue.expiresAt).getTime() -
          new Date(offerValue.createdAt).getTime(),
      ).toBe(DAY * 1000);

      const seen = await conversationFor(seller.token, conversation.id);
      expect(seen).toMatchObject({
        product: { pickup: true, deliveryFee: 1500 },
        otherUser: { name: "Awa Diarra", location: "Hamdallaye ACI, Bamako" },
        lastMessage: { id: message.id, kind: "offer" },
        unreadCount: 1,
        deal: {
          offer: { id: offerValue.id, status: "pending" },
          order: null,
          reservedElsewhereUntil: null,
        },
      });
      for (const id of [buyer.id, seller.id]) {
        expect(sentTo(id, "message:new")).toEqual([{ message }]);
      }
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(1));
      expect(t.push.sent[0]).toMatchObject({
        to: SELLER_PUSH,
        title: "Awa Diarra",
        body: "Offre : 17 200 F, livraison comprise",
        data: { type: "message", conversationId: conversation.id },
      });
    });

    it("offers only the ways of getting the item the listing has", async () => {
      const pickupOnly = await createListing({ deliveryFee: null });
      const deliveryOnly = await createListing({ pickup: false });
      const both = await createListing();
      const aboutPickupOnly = await openConversation(
        buyer.token,
        pickupOnly.id,
      );
      const aboutDeliveryOnly = await openConversation(
        buyer.token,
        deliveryOnly.id,
      );
      const aboutBoth = await openConversation(buyer.token, both.id);

      const delivery = { fulfilment: "delivery", deliveryArea: "ACI" } as const;
      expect(
        (
          await offer(buyer.token, aboutPickupOnly.id, {
            amount: 15000,
            ...delivery,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await offer(buyer.token, aboutDeliveryOnly.id, { amount: 15000 }))
          .statusCode,
      ).toBe(400);
      // Delivery needs an address
      expect(
        (
          await offer(buyer.token, aboutBoth.id, {
            amount: 15000,
            fulfilment: "delivery",
          })
        ).statusCode,
      ).toBe(400);
      // The seller's courier stays in their city
      await prisma.user.update({
        where: { id: buyer.id },
        data: { city: "Ségou" },
      });
      expect(
        (await offer(buyer.token, aboutBoth.id, { amount: 15000, ...delivery }))
          .statusCode,
      ).toBe(400);
      expect(await prisma.offer.count()).toBe(0);
    });

    it("keeps the amount between 1 F and the listed price, delivery included", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const delivery = { fulfilment: "delivery", deliveryArea: "ACI" } as const;

      expect(
        (await offer(buyer.token, id, { amount: 18701, ...delivery }))
          .statusCode,
      ).toBe(400);
      expect((await offer(buyer.token, id, { amount: 17201 })).statusCode).toBe(
        400,
      );
      expect((await offer(buyer.token, id, { amount: 0 })).statusCode).toBe(
        400,
      );
      expect(
        (await offer(buyer.token, id, { amount: 18700, ...delivery }))
          .statusCode,
      ).toBe(201);
    });

    it("lets the buyer start; the seller only answers, outsiders can't", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);

      const first = await offer(seller.token, id, { amount: 16000 });
      expect(first.statusCode).toBe(409);
      expect(first.json()).toMatchObject({ error: "conflict" });
      expect(
        (await offer(outsider.token, id, { amount: 16000 })).statusCode,
      ).toBe(404);
    });

    it("refuses offers on a sold listing", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      await prisma.product.update({
        where: { id: listing.id },
        data: { status: "sold" },
      });
      expect((await offer(buyer.token, id, { amount: 15000 })).statusCode).toBe(
        409,
      );
    });

    it("saves an offer once, even when the app sends it again", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const other = await openConversation(
        buyer.token,
        (await createListing()).id,
      );
      const id = randomUUID();

      const first = await offered(buyer.token, conversation.id, {
        id,
        amount: 15000,
      });
      const again = await offered(buyer.token, conversation.id, {
        id,
        amount: 15000,
      });
      expect(again.id).toBe(first.id);
      expect(await prisma.offer.count()).toBe(1);
      expect(await prisma.message.count()).toBe(1);
      // Someone else's id, or another conversation's
      expect(
        (await offer(buyer.token, other.id, { id, amount: 15000 })).statusCode,
      ).toBe(400);
    });
  });

  describe("counter-offers", () => {
    it("keeps the buyer's choice and replaces the pending offer", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const first = await offered(buyer.token, conversation.id, {
        amount: 16000,
        fulfilment: "delivery",
        deliveryArea: "Hamdallaye ACI",
      });

      // The seller can't switch to pickup
      expect(
        (await offer(seller.token, conversation.id, { amount: 15000 }))
          .statusCode,
      ).toBe(400);
      const counter = await offered(seller.token, conversation.id, {
        amount: 17200,
        fulfilment: "delivery",
        deliveryArea: "Somewhere else",
      });
      expect(counter.offer).toMatchObject({
        authorId: seller.id,
        amount: 17200,
        fulfilment: "delivery",
        deliveryFee: 1500,
        deliveryArea: "Hamdallaye ACI",
        status: "pending",
      });

      const messages = await messagesOf(buyer.token, conversation.id);
      expect(messages.map((m) => [m.offer?.amount, m.offer?.status])).toEqual([
        [17200, "pending"],
        [16000, "superseded"],
      ]);
      const deal = (await conversationFor(buyer.token, conversation.id)).deal;
      expect(deal.offer).toMatchObject({ id: counter.offer?.id });
      expect(sentTo(buyer.id, "offer:updated")).toEqual([
        { offer: { ...first.offer, status: "superseded" } },
      ]);
    });

    it("lets the buyer answer the seller's counter-offer with a new one, mode included", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      await offered(buyer.token, id, {
        amount: 16000,
        fulfilment: "delivery",
        deliveryArea: "Hamdallaye ACI",
      });
      await offered(seller.token, id, {
        amount: 17500,
        fulfilment: "delivery",
      });

      const pickup = await offered(buyer.token, id, { amount: 15500 });
      expect(pickup.offer).toMatchObject({
        fulfilment: "pickup",
        deliveryFee: null,
        deliveryArea: null,
      });
    });
  });

  describe("answering", () => {
    it("accepting starts the order and holds the listing for the buyer", async () => {
      await registerPushToken(seller.token, SELLER_PUSH);
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const rivals = await openConversation(rival.token, listing.id);
      await offered(buyer.token, conversation.id, {
        amount: 16000,
        fulfilment: "delivery",
        deliveryArea: "Hamdallaye ACI",
      });
      const counter = await offered(seller.token, conversation.id, {
        amount: 17200,
        fulfilment: "delivery",
      });
      const counterId = counter.offer?.id as string;

      const res = await answer(buyer.token, counterId, "accept");
      expect(res.statusCode).toBe(200);
      const { offer: accepted, order } = res.json<AcceptedOffer>();
      expect(accepted).toMatchObject({ id: counterId, status: "accepted" });
      expect(order).toMatchObject({
        conversationId: conversation.id,
        productId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        offerId: counterId,
        amount: 17200,
        listPrice: 17200,
        fulfilment: "delivery",
        deliveryFee: 1500,
        deliveryArea: "Hamdallaye ACI",
        status: "awaiting_payment",
        paidAt: null,
      });
      expect(
        new Date(order.reservedUntil).getTime() -
          new Date(order.createdAt).getTime(),
      ).toBe(DAY * 1000);

      const [deal] = await messagesOf(seller.token, conversation.id);
      expect(deal).toMatchObject({
        senderId: buyer.id,
        kind: "deal",
        body: "Marché conclu : 17 200 F, livraison comprise",
        order: { id: order.id, status: "awaiting_payment" },
      });
      expect(
        (await conversationFor(buyer.token, conversation.id)).deal,
      ).toMatchObject({
        offer: { id: counterId, status: "accepted" },
        order: { id: order.id },
        reservedElsewhereUntil: null,
      });
      for (const id of [buyer.id, seller.id]) {
        expect(sentTo(id, "offer:updated")).toContainEqual({ offer: accepted });
        expect(sentTo(id, "order:updated")).toEqual([{ order }]);
      }
      await vi.waitFor(() =>
        expect(t.push.sent.map((m) => m.body)).toContain(
          "Marché conclu : 17 200 F, livraison comprise",
        ),
      );

      // Held: another buyer can't negotiate, the seller can't sell it elsewhere
      expect(
        (await conversationFor(rival.token, rivals.id)).deal
          .reservedElsewhereUntil,
      ).toBe(order.reservedUntil);
      const rivalOffer = await offer(rival.token, rivals.id, { amount: 17000 });
      expect(rivalOffer.statusCode).toBe(409);
      for (const request of [
        {
          method: "PATCH",
          url: `/listings/${listing.id}/status`,
          payload: { sold: true },
        },
        { method: "DELETE", url: `/listings/${listing.id}` },
      ] as const) {
        expect((await t.authed(seller.token, request)).statusCode).toBe(409);
      }
    });

    it("lets only the other person answer, once", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const sent = await offered(buyer.token, id, { amount: 15000 });
      const offerId = sent.offer?.id as string;

      expect((await answer(buyer.token, offerId, "accept")).statusCode).toBe(
        403,
      );
      expect((await answer(outsider.token, offerId, "accept")).statusCode).toBe(
        404,
      );
      expect((await answer(seller.token, offerId, "accept")).statusCode).toBe(
        200,
      );
      expect((await answer(seller.token, offerId, "decline")).statusCode).toBe(
        409,
      );
      expect((await answer(seller.token, offerId, "accept")).statusCode).toBe(
        409,
      );
      expect(await prisma.order.count()).toBe(1);
    });

    it("refuses to answer a replaced offer", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const first = await offered(buyer.token, id, { amount: 15000 });
      await offered(buyer.token, id, { amount: 15500 });

      const res = await answer(
        seller.token,
        first.offer?.id as string,
        "accept",
      );
      expect(res.statusCode).toBe(409);
    });

    it("declines: the buyer is told, the conversation goes on", async () => {
      await registerPushToken(buyer.token, BUYER_PUSH);
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const sent = await offered(buyer.token, id, { amount: 15000 });

      const res = await answer(
        seller.token,
        sent.offer?.id as string,
        "decline",
      );
      expect(res.statusCode).toBe(200);
      const declined = res.json<Offer>();
      expect(declined).toMatchObject({ status: "declined" });
      expect(declined.respondedAt).not.toBeNull();
      expect(sentTo(buyer.id, "offer:updated")).toEqual([{ offer: declined }]);
      await vi.waitFor(() =>
        expect(t.push.sent.map((m) => [m.to, m.body])).toContainEqual([
          BUYER_PUSH,
          "Offre de 15 000 F refusée",
        ]),
      );
      // Nothing pending: the seller can't make an offer, the buyer can
      expect(
        (await offer(seller.token, id, { amount: 16000 })).statusCode,
      ).toBe(409);
      await offered(buyer.token, id, { amount: 16000 });
    });

    it("lets one of two agreements at once on a listing through", async () => {
      const listing = await createListing();
      const mine = await openConversation(buyer.token, listing.id);
      const theirs = await openConversation(rival.token, listing.id);
      const a = await offered(buyer.token, mine.id, { amount: 16000 });
      const b = await offered(rival.token, theirs.id, { amount: 16500 });

      const results = await Promise.all([
        answer(seller.token, a.offer?.id as string, "accept"),
        answer(seller.token, b.offer?.id as string, "accept"),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      expect(await prisma.order.count()).toBe(1);
      // The refused one is still pending: nothing half done
      expect(await prisma.offer.count({ where: { status: "accepted" } })).toBe(
        1,
      );
    });
  });

  describe("deadlines", () => {
    it("expires an offer left unanswered for 24 h", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const sent = await offered(buyer.token, id, { amount: 15000 });
      const offerId = sent.offer?.id as string;

      await later(DAY - 1);
      expect((await conversationFor(seller.token, id)).deal.offer?.status).toBe(
        "pending",
      );
      await later(1);
      expect((await conversationFor(seller.token, id)).deal.offer?.status).toBe(
        "expired",
      );
      expect((await answer(seller.token, offerId, "accept")).statusCode).toBe(
        409,
      );
      expect(
        (await offer(seller.token, id, { amount: 16000 })).statusCode,
      ).toBe(409);

      // A new offer takes its place, and the old one is written expired
      await offered(buyer.token, id, { amount: 15500 });
      expect(
        (await prisma.offer.findUniqueOrThrow({ where: { id: offerId } }))
          .status,
      ).toBe("expired");
    });

    it("frees the listing when the agreement isn't paid in 24 h", async () => {
      const listing = await createListing();
      const mine = await openConversation(buyer.token, listing.id);
      const theirs = await openConversation(rival.token, listing.id);
      const sent = await offered(buyer.token, mine.id, { amount: 16000 });
      const { order } = (
        await answer(seller.token, sent.offer?.id as string, "accept")
      ).json<AcceptedOffer>();

      await later(DAY);
      expect(
        (await conversationFor(buyer.token, mine.id)).deal.order?.status,
      ).toBe("expired");
      expect(
        (await conversationFor(rival.token, theirs.id)).deal
          .reservedElsewhereUntil,
      ).toBeNull();

      const rivalOffer = await offered(rival.token, theirs.id, {
        amount: 16500,
      });
      events.mockClear();
      const res = await answer(
        seller.token,
        rivalOffer.offer?.id as string,
        "accept",
      );
      expect(res.statusCode).toBe(200);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
          .status,
      ).toBe("expired");
      expect(sentTo(buyer.id, "order:updated")).toEqual([
        { order: { ...order, status: "expired" } },
      ]);
    });

    it("cancels an unpaid agreement when the buyer makes a new offer", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const sent = await offered(buyer.token, id, { amount: 16000 });
      const { order } = (
        await answer(seller.token, sent.offer?.id as string, "accept")
      ).json<AcceptedOffer>();
      // Agreed: the seller has nothing to answer
      expect(
        (await offer(seller.token, id, { amount: 17000 })).statusCode,
      ).toBe(409);

      events.mockClear();
      await offered(buyer.token, id, {
        amount: 17000,
        fulfilment: "delivery",
        deliveryArea: "Hamdallaye ACI",
      });
      const cancelled = { ...order, status: "cancelled" };
      expect(sentTo(seller.id, "order:updated")).toEqual([
        { order: cancelled },
      ]);
      expect((await conversationFor(buyer.token, id)).deal).toMatchObject({
        offer: { amount: 17000, status: "pending" },
        order: { id: order.id, status: "cancelled" },
      });
    });
  });

  describe("listings", () => {
    it("saves pickup and the delivery fee, and needs at least one", async () => {
      const photo = (
        await t.upload(seller.token, "/media/product-images", await testPhoto())
      ).json<{ path: string }>().path;
      const body = {
        title: "Nike Air Force 1",
        description: "",
        price: 17200,
        categoryId,
        condition: "used",
        size: "42",
        imagePaths: [photo],
      };

      const neither = await t.authed(seller.token, {
        method: "POST",
        url: "/listings",
        payload: { ...body, pickup: false, deliveryFee: null },
      });
      expect(neither.statusCode).toBe(400);

      const created = await t.authed(seller.token, {
        method: "POST",
        url: "/listings",
        payload: { ...body, pickup: false, deliveryFee: 2000 },
      });
      expect(created.statusCode).toBe(201);
      const { id } = created.json<{ id: string }>();
      expect(await get(buyer.token, `/products/${id}`)).toMatchObject({
        pickup: false,
        deliveryFee: 2000,
      });
    });
  });
});
