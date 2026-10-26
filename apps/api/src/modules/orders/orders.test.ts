import {
  type AcceptedOffer,
  type ChatMessage,
  type Conversation,
  type DirectBuyBody,
  type MessagePage,
  type Order,
  type OrderDetails,
  type Payment,
  type PaymentBody,
} from "@dily/shared";
import Fastify from "fastify";
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
import {
  SimulatedPaymentGateway,
  simulatedOutcome,
} from "./payment-gateway.js";

const SELLER_PUSH = "ExponentPushToken[seller-phone]";
const BUYER_PUSH = "ExponentPushToken[buyer-phone]";
const BUYER_PHONE = "+22370000002";
const MINUTE = 60;

describe("simulated payments", () => {
  it("answers by the payer's number", () => {
    const paymentId = randomUUID();
    expect(simulatedOutcome({ paymentId, payerPhone: "+22370000000" })).toEqual(
      { status: "succeeded", reference: `SIM-${paymentId.slice(0, 8)}` },
    );
    expect(simulatedOutcome({ paymentId, payerPhone: "+22370000099" })).toEqual(
      { status: "failed", reason: "refused" },
    );
    expect(simulatedOutcome({ paymentId, payerPhone: "+22370000098" })).toEqual(
      { status: "failed", reason: "insufficient_funds" },
    );
    expect(simulatedOutcome({ paymentId, payerPhone: "+22370000097" })).toBe(
      null,
    );
  });

  it("answers after the delay, never for an unconfirmed payment", async () => {
    const gateway = new SimulatedPaymentGateway(10, Fastify().log);
    const answers: string[] = [];
    gateway.onOutcome(async (id, outcome) => {
      answers.push(`${id}:${outcome.status}`);
    });
    const request = { provider: "orange_money", amount: 17200 } as const;
    await gateway.request({
      ...request,
      paymentId: "a",
      payerPhone: "+22370000000",
    });
    await gateway.request({
      ...request,
      paymentId: "b",
      payerPhone: "+22370000097",
    });
    expect(answers).toEqual([]);
    await vi.waitFor(() => expect(answers).toEqual(["a:succeeded"]));
  });
});

describe.skipIf(!hasTestServices)("orders", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  type TestUser = { id: string; token: string; refreshToken: string };
  let t: TestApp;
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
    ) => {
      const session = await t.login(phone);
      await prisma.user.update({
        where: { id: session.userId },
        data: { fullName, neighbourhood },
      });
      return {
        id: session.userId,
        token: session.accessToken,
        refreshToken: session.refreshToken,
      };
    };
    seller = await signIn("+22370000001", "Mamadou Diallo", "Badalabougou");
    buyer = await signIn(BUYER_PHONE, "Awa Diarra", "Hamdallaye ACI");
    rival = await signIn("+22370000003", "Fanta Keita", "Lafiabougou");
    outsider = await signIn("+22370000004", "Ali Touré", "Sogoniko");
    categoryId = (await createCategory(prisma)).id;
    events = vi.spyOn(t.services.notifier, "send");
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Moves the clock on, with fresh access tokens for everyone, as the app would. */
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

  /** Nike Air Force 1 at 17 200 F, pickup in Badalabougou or delivery for 1 500 F. */
  const createListing = () =>
    prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        title: "Nike Air Force 1",
        price: 17200,
        deliveryFee: 1500,
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

  // Each action a second after the previous one, as in real use
  const post = (token: string, url: string, payload?: object) => {
    t.advance(1);
    return t.authed(token, {
      method: "POST",
      url,
      ...(payload ? { payload } : {}),
    });
  };

  const buy = (token: string, body: DirectBuyBody) =>
    post(token, "/orders", body);

  const deliveryBuy = (conversationId: string): DirectBuyBody => ({
    conversationId,
    fulfilment: "delivery",
    deliveryArea: "Hamdallaye ACI",
  });

  /** A direct buy that must go through. */
  const bought = async (token: string, body: DirectBuyBody) => {
    const res = await buy(token, body);
    expect(res.statusCode, res.body).toBe(201);
    return res.json<Order>();
  };

  const pay = (
    token: string,
    orderId: string,
    body: Partial<PaymentBody> = {},
  ) =>
    post(token, `/orders/${orderId}/payments`, {
      id: randomUUID(),
      provider: "orange_money",
      payerPhone: BUYER_PHONE,
      ...body,
    });

  /** A payment attempt that must start. */
  const paying = async (
    token: string,
    orderId: string,
    body: Partial<PaymentBody> = {},
  ) => {
    const res = await pay(token, orderId, body);
    expect(res.statusCode, res.body).toBe(201);
    return res.json<Payment>();
  };

  const get = async <T>(token: string, url: string) =>
    (await t.authed(token, { method: "GET", url })).json<T>();

  const orderDetails = (token: string, orderId: string) =>
    get<OrderDetails>(token, `/orders/${orderId}`);

  const registerPushToken = (token: string, pushToken: string) =>
    t.authed(token, {
      method: "PUT",
      url: "/me/push-token",
      payload: { token: pushToken, platform: "ios" },
    });

  const sentTo = (userId: string, event: string) =>
    events.mock.calls
      .filter(([to, name]) => to === userId && name === event)
      .map(([, , payload]) => payload);

  /** An agreement at 16 000 F for pickup: the order waiting for payment. */
  const agreed = async (conversationId: string) => {
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
    return res.json<AcceptedOffer>().order;
  };

  describe("buying at the listed price", () => {
    it("holds the listing 30 minutes for the buyer, delivery included", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const rivals = await openConversation(rival.token, listing.id);
      // A pending offer: buying ends the negotiation
      const offer = (
        await post(buyer.token, `/conversations/${conversation.id}/offers`, {
          id: randomUUID(),
          amount: 15000,
          fulfilment: "pickup",
        })
      ).json<ChatMessage>();

      const order = await bought(buyer.token, deliveryBuy(conversation.id));
      expect(order).toMatchObject({
        conversationId: conversation.id,
        productId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        offerId: null,
        amount: 18700,
        listPrice: 17200,
        fulfilment: "delivery",
        deliveryFee: 1500,
        deliveryArea: "Hamdallaye ACI",
        landmark: null,
        contactPhone: null,
        status: "awaiting_payment",
      });
      expect(
        new Date(order.reservedUntil).getTime() -
          new Date(order.createdAt).getTime(),
      ).toBe(30 * MINUTE * 1000);

      expect(
        (
          await get<Conversation>(
            buyer.token,
            `/conversations/${conversation.id}`,
          )
        ).deal,
      ).toMatchObject({
        offer: { id: offer.offer?.id, status: "superseded" },
        order: { id: order.id, status: "awaiting_payment" },
      });
      for (const id of [buyer.id, seller.id]) {
        expect(sentTo(id, "order:updated")).toEqual([{ order }]);
      }
      expect((await buy(rival.token, deliveryBuy(rivals.id))).statusCode).toBe(
        409,
      );
      // Twice is once too many
      expect(
        (await buy(buyer.token, deliveryBuy(conversation.id))).statusCode,
      ).toBe(409);
    });

    it("is for the conversation's buyer, on an available listing", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);

      expect((await buy(seller.token, deliveryBuy(id))).statusCode).toBe(403);
      expect((await buy(outsider.token, deliveryBuy(id))).statusCode).toBe(404);
      // Delivery needs an address
      expect(
        (await buy(buyer.token, { conversationId: id, fulfilment: "delivery" }))
          .statusCode,
      ).toBe(400);
      await prisma.product.update({
        where: { id: listing.id },
        data: { status: "sold" },
      });
      expect((await buy(buyer.token, deliveryBuy(id))).statusCode).toBe(409);
      expect(await prisma.order.count()).toBe(0);
    });

    it("is refused once the buyer agreed on a price: they pay that one", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      await agreed(id);
      expect((await buy(buyer.token, deliveryBuy(id))).statusCode).toBe(409);
    });
  });

  describe("paying", () => {
    it("asks the operator, then pays the order, sells the listing and shows it in the chat", async () => {
      await registerPushToken(seller.token, SELLER_PUSH);
      await registerPushToken(buyer.token, BUYER_PUSH);
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(conversation.id));

      const payment = await paying(buyer.token, order.id, {
        provider: "moov_money",
        payerPhone: "+22365000000",
        landmark: "Derrière la pharmacie, portail vert",
      });
      expect(payment).toMatchObject({
        orderId: order.id,
        provider: "moov_money",
        payerPhone: "+22365000000",
        amount: 18700,
        status: "pending",
        failureReason: null,
        settledAt: null,
      });
      expect(
        new Date(payment.expiresAt).getTime() -
          new Date(payment.createdAt).getTime(),
      ).toBe(120 * 1000);
      expect(t.payments.requests).toEqual([
        {
          paymentId: payment.id,
          provider: "moov_money",
          payerPhone: "+22365000000",
          amount: 18700,
        },
      ]);
      // The courier calls the buyer's own number unless they gave another
      expect(await orderDetails(buyer.token, order.id)).toMatchObject({
        order: {
          landmark: "Derrière la pharmacie, portail vert",
          contactPhone: BUYER_PHONE,
          status: "awaiting_payment",
        },
        payment: { id: payment.id, status: "pending" },
      });
      // The seller sees the order, not the buyer's payment
      expect((await orderDetails(seller.token, order.id)).payment).toBeNull();
      expect(
        (
          await t.authed(outsider.token, {
            method: "GET",
            url: `/orders/${order.id}`,
          })
        ).statusCode,
      ).toBe(404);

      events.mockClear();
      await t.payments.answer(payment.id, {
        status: "succeeded",
        reference: "MP-0001",
      });

      const details = await orderDetails(buyer.token, order.id);
      expect(details.order).toMatchObject({ status: "paid" });
      expect(details.order.paidAt).not.toBeNull();
      expect(details.payment).toMatchObject({ status: "succeeded" });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: listing.id } }))
          .status,
      ).toBe("sold");
      const [paid] = (
        await get<MessagePage>(
          seller.token,
          `/conversations/${conversation.id}/messages`,
        )
      ).items;
      expect(paid).toMatchObject({
        kind: "deal",
        senderId: buyer.id,
        body: "Payé : 18 700 F, livraison comprise",
        order: { id: order.id, status: "paid" },
      });
      expect(sentTo(buyer.id, "payment:updated")).toEqual([
        { payment: details.payment },
      ]);
      expect(sentTo(seller.id, "payment:updated")).toEqual([]);
      for (const id of [buyer.id, seller.id]) {
        expect(sentTo(id, "order:updated")).toEqual([{ order: details.order }]);
        expect(sentTo(id, "message:new")).toEqual([{ message: paid }]);
      }
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(2));
      expect(t.push.sent.map((m) => [m.to, m.body])).toEqual(
        expect.arrayContaining([
          [
            SELLER_PUSH,
            "Paiement reçu : 18 700 F. Dily le garde jusqu'à la remise.",
          ],
          [BUYER_PUSH, "Paiement confirmé : 18 700 F"],
        ]),
      );

      // Paid once, and for good
      expect((await pay(buyer.token, order.id)).statusCode).toBe(409);
      expect(
        (
          await t.authed(seller.token, {
            method: "PATCH",
            url: `/listings/${listing.id}/status`,
            payload: { sold: false },
          })
        ).statusCode,
      ).toBe(409);
    });

    it("pays an agreed price; pickup needs no courier details", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const order = await agreed(conversation.id);
      const before = await prisma.message.count();

      const payment = await paying(buyer.token, order.id, {
        landmark: "Not for pickup",
        contactPhone: "+22376000000",
      });
      expect(payment.amount).toBe(16000);
      await t.payments.answer(payment.id, {
        status: "succeeded",
        reference: "OM-0001",
      });

      const details = await orderDetails(buyer.token, order.id);
      expect(details.order).toMatchObject({
        status: "paid",
        landmark: null,
        contactPhone: null,
      });
      // The deal is already in the chat
      expect(await prisma.message.count()).toBe(before);
    });

    it("lets the buyer try again after a refusal", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));

      const refused = await paying(buyer.token, order.id);
      await t.payments.answer(refused.id, {
        status: "failed",
        reason: "insufficient_funds",
      });
      const details = await orderDetails(buyer.token, order.id);
      expect(details.payment).toMatchObject({
        id: refused.id,
        status: "failed",
        failureReason: "insufficient_funds",
      });
      expect(details.order.status).toBe("awaiting_payment");
      expect(sentTo(buyer.id, "payment:updated")).toEqual([
        { payment: details.payment },
      ]);

      const retry = await paying(buyer.token, order.id);
      await t.payments.answer(retry.id, {
        status: "succeeded",
        reference: "R",
      });
      expect((await orderDetails(buyer.token, order.id)).order.status).toBe(
        "paid",
      );
    });

    it("runs one attempt at a time; one never confirmed gives way after 2 minutes", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));
      const first = await paying(buyer.token, order.id);

      const second = await pay(buyer.token, order.id);
      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ error: "conflict" });

      await later(120);
      expect((await orderDetails(buyer.token, order.id)).payment?.status).toBe(
        "expired",
      );
      await paying(buyer.token, order.id);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: first.id } }))
          .status,
      ).toBe("expired");
    });

    it("stops waiting when the buyer got nothing; a late answer changes nothing", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));
      const payment = await paying(buyer.token, order.id);
      const cancelUrl = `/orders/${order.id}/payments/${payment.id}/cancel`;

      expect((await post(seller.token, cancelUrl)).statusCode).toBe(404);
      const res = await post(buyer.token, cancelUrl);
      expect(res.statusCode).toBe(200);
      expect(res.json<Payment>()).toMatchObject({ status: "cancelled" });
      expect(sentTo(buyer.id, "payment:updated")).toEqual([
        { payment: res.json() },
      ]);

      await t.payments.answer(payment.id, {
        status: "succeeded",
        reference: "LATE",
      });
      expect((await orderDetails(buyer.token, order.id)).order.status).toBe(
        "awaiting_payment",
      );
      // Cancelling again: nothing left to cancel
      expect((await post(buyer.token, cancelUrl)).json()).toMatchObject({
        status: "cancelled",
      });
      await paying(buyer.token, order.id);
    });

    it("saves an attempt once, even when the app sends it again", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));
      const paymentId = randomUUID();

      const first = await paying(buyer.token, order.id, { id: paymentId });
      const again = await paying(buyer.token, order.id, { id: paymentId });
      expect(again.id).toBe(first.id);
      expect(t.payments.requests).toHaveLength(1);
    });

    it("lets only the buyer pay, while the order holds the listing", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));

      expect((await pay(seller.token, order.id)).statusCode).toBe(404);
      await later(30 * MINUTE);
      expect((await pay(buyer.token, order.id)).statusCode).toBe(409);
      expect((await orderDetails(buyer.token, order.id)).order.status).toBe(
        "expired",
      );
    });

    it("keeps the hold while the payer confirms", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));

      await later(29 * MINUTE);
      const payment = await paying(buyer.token, order.id);
      const { order: held } = await orderDetails(buyer.token, order.id);
      expect(held.reservedUntil).toBe(payment.expiresAt);

      // Past the 30 minutes, the operator's answer still pays it
      await later(MINUTE + 30);
      await t.payments.answer(payment.id, {
        status: "succeeded",
        reference: "S",
      });
      expect((await orderDetails(buyer.token, order.id)).order.status).toBe(
        "paid",
      );
    });

    it("goes through on its own with the simulated operator", async () => {
      t = await createTestApp(prisma, redis, { simulatedPayments: true });
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));

      // Numbers ending in 99 are refused
      const refused = await paying(buyer.token, order.id, {
        payerPhone: "+22370000099",
      });
      await vi.waitFor(async () =>
        expect(
          (await orderDetails(buyer.token, order.id)).payment,
        ).toMatchObject({
          id: refused.id,
          status: "failed",
          failureReason: "refused",
        }),
      );
      await paying(buyer.token, order.id);
      await vi.waitFor(async () =>
        expect((await orderDetails(buyer.token, order.id)).order.status).toBe(
          "paid",
        ),
      );
    });

    it("fails the attempt when the operator can't be reached", async () => {
      const listing = await createListing();
      const { id } = await openConversation(buyer.token, listing.id);
      const order = await bought(buyer.token, deliveryBuy(id));
      t.payments.unreachable = true;

      const payment = await paying(buyer.token, order.id);
      expect(payment).toMatchObject({
        status: "failed",
        failureReason: "unavailable",
      });
    });
  });
});
