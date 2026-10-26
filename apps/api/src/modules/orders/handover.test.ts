import {
  type AcceptedOffer,
  type ChatMessage,
  type Conversation,
  type DisputeBody,
  type MessagePage,
  type Order,
  type OrderDetails,
  type Payment,
  type Profile,
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
const BUYER_PHONE = "+22370000002";
const SELLER_PAYOUT = { provider: "moov_money", phone: "+22376000001" };
const DAY = 24 * 60 * 60;

describe.skipIf(!hasTestServices)("after the payment", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  type TestUser = { id: string; token: string; refreshToken: string };
  let t: TestApp;
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
        data: { fullName },
      });
      return {
        id: session.userId,
        token: session.accessToken,
        refreshToken: session.refreshToken,
      };
    };
    seller = await signIn("+22370000001", "Mamadou Diallo");
    buyer = await signIn(BUYER_PHONE, "Awa Diarra");
    outsider = await signIn("+22370000004", "Ali Touré");
    categoryId = (await createCategory(prisma)).id;
    events = vi.spyOn(t.services.notifier, "send");
    for (const [user, token] of [
      [seller, SELLER_PUSH],
      [buyer, BUYER_PUSH],
    ] as const) {
      await t.authed(user.token, {
        method: "PUT",
        url: "/me/push-token",
        payload: { token, platform: "ios" },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  /** Moves the clock on, with fresh access tokens for everyone, as the app would. */
  const later = async (seconds: number) => {
    t.advance(seconds);
    for (const user of [seller, buyer, outsider]) {
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

  const post = (token: string, url: string, payload?: object) => {
    t.advance(1);
    return t.authed(token, {
      method: "POST",
      url,
      ...(payload ? { payload } : {}),
    });
  };

  const get = async <T>(token: string, url: string) =>
    (await t.authed(token, { method: "GET", url })).json<T>();

  const details = (token: string, orderId: string) =>
    get<OrderDetails>(token, `/orders/${orderId}`);

  const sentTo = (userId: string, event: string) =>
    events.mock.calls
      .filter(([to, name]) => to === userId && name === event)
      .map(([, , payload]) => payload);

  const pushedTo = (token: string) =>
    t.push.sent.filter((m) => m.to === token).map((m) => m.body);

  const setPayoutAccount = (token: string, account = SELLER_PAYOUT) =>
    t.authed(token, {
      method: "PUT",
      url: "/me/payout-account",
      payload: account,
    });

  const latestMessage = async (conversationId: string) =>
    (
      await get<MessagePage>(
        seller.token,
        `/conversations/${conversationId}/messages`,
      )
    ).items[0];

  /**
   * Nike Air Force 1 agreed at 16 000 F for pickup, paid with Orange Money
   * from the buyer's number: the order waiting for its handover.
   */
  const paidOrder = async () => {
    const listing = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        title: "Nike Air Force 1",
        price: 17200,
        deliveryFee: 1500,
        images: { create: [{ path: "https://example.test/1.jpg" }] },
      },
    });
    const conversation = (
      await t.authed(buyer.token, {
        method: "POST",
        url: "/conversations",
        payload: { productId: listing.id },
      })
    ).json<Conversation>();
    const offer = (
      await post(buyer.token, `/conversations/${conversation.id}/offers`, {
        id: randomUUID(),
        amount: 16000,
        fulfilment: "pickup",
      })
    ).json<ChatMessage>();
    const { order } = (
      await post(seller.token, `/offers/${offer.offer?.id as string}/accept`)
    ).json<AcceptedOffer>();
    const payment = (
      await post(buyer.token, `/orders/${order.id}/payments`, {
        id: randomUUID(),
        provider: "orange_money",
        payerPhone: BUYER_PHONE,
      })
    ).json<Payment>();
    await t.payments.answer(payment.id, {
      status: "succeeded",
      reference: "OM-0001",
    });
    // The payment's own notifications, sent in the background
    await vi.waitFor(() =>
      expect(t.push.sent.map((m) => m.body)).toEqual(
        expect.arrayContaining([
          "Paiement reçu : 16 000 F. Dily le garde jusqu'à la remise.",
          "Paiement confirmé : 16 000 F",
        ]),
      ),
    );
    t.push.sent.length = 0;
    events.mockClear();
    return { order, listing, conversation };
  };

  const handover = (token: string, orderId: string, code: string) =>
    post(token, `/orders/${orderId}/handover`, { code });

  const codeOf = async (orderId: string) =>
    (await details(buyer.token, orderId)).handoverCode as string;

  const dispute = (orderId: string, body: DisputeBody, token = buyer.token) =>
    post(token, `/orders/${orderId}/dispute`, body);

  const uploadReportPhoto = async (token = buyer.token) => {
    const res = await t.upload(
      token,
      "/media/report-images",
      await testPhoto(),
    );
    expect(res.statusCode, res.body).toBe(201);
    return res.json<{ path: string }>().path;
  };

  describe("the handover code", () => {
    it("is the buyer's alone, from the payment until the handover", async () => {
      const { order, conversation } = await paidOrder();

      const code = await codeOf(order.id);
      expect(code).toMatch(/^[0-9]{4}$/);
      expect((await details(seller.token, order.id)).handoverCode).toBeNull();
      // Nowhere the seller could read it
      const seen = JSON.stringify([
        await get(seller.token, `/conversations/${conversation.id}`),
        await get(seller.token, `/conversations/${conversation.id}/messages`),
      ]);
      expect(seen).not.toContain("handoverCode");
    });

    it("typed by the seller hands the item over: the money leaves for their account", async () => {
      await setPayoutAccount(seller.token);
      const { order, listing, conversation } = await paidOrder();
      const code = await codeOf(order.id);

      const wrong = await handover(
        seller.token,
        order.id,
        code === "0000" ? "1111" : "0000",
      );
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ error: "handover_code_invalid" });
      // Only the seller types it
      expect((await handover(buyer.token, order.id, code)).statusCode).toBe(
        404,
      );
      expect((await handover(outsider.token, order.id, code)).statusCode).toBe(
        404,
      );

      const res = await handover(seller.token, order.id, code);
      expect(res.statusCode, res.body).toBe(200);
      const sellerView = res.json<OrderDetails>();
      expect(sellerView.order).toMatchObject({ status: "completed" });
      expect(sellerView.order.completedAt).not.toBeNull();
      expect(sellerView.transfer).toMatchObject({
        kind: "payout",
        amount: 16000,
        provider: "moov_money",
        phone: SELLER_PAYOUT.phone,
        status: "pending",
      });
      expect(t.payments.transfers).toEqual([
        {
          transferId: sellerView.transfer?.id,
          provider: "moov_money",
          phone: SELLER_PAYOUT.phone,
          amount: 16000,
        },
      ]);
      const buyerView = await details(buyer.token, order.id);
      expect(buyerView.handoverCode).toBeNull();
      // The payout is the seller's business
      expect(buyerView.transfer).toBeNull();
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: listing.id } }))
          .status,
      ).toBe("sold");

      const message = await latestMessage(conversation.id);
      expect(message).toMatchObject({
        kind: "handover",
        senderId: seller.id,
        body: "Remis : 16 000 F pour le vendeur",
        order: { id: order.id, status: "completed" },
      });
      for (const id of [buyer.id, seller.id]) {
        expect(sentTo(id, "order:updated")).toEqual([
          { order: sellerView.order },
        ]);
        expect(sentTo(id, "message:new")).toEqual([{ message }]);
      }
      expect(sentTo(seller.id, "transfer:updated")).toEqual([
        { transfer: sellerView.transfer },
      ]);
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(2));
      expect(pushedTo(SELLER_PUSH)).toEqual([
        "Remise confirmée : 16 000 F partent sur ton Moov Money.",
      ]);
      expect(pushedTo(BUYER_PUSH)).toEqual([
        "Remise confirmée. Merci d'avoir acheté sur Dily !",
      ]);

      // The operator sent it
      events.mockClear();
      await t.payments.answerTransfer(sellerView.transfer?.id as string, {
        status: "succeeded",
        reference: "MP-PAY-1",
      });
      const paidOut = (await details(seller.token, order.id)).transfer;
      expect(paidOut).toMatchObject({ status: "succeeded" });
      expect(paidOut?.settledAt).not.toBeNull();
      expect(sentTo(seller.id, "transfer:updated")).toEqual([
        { transfer: paidOut },
      ]);

      // Once is enough
      expect((await handover(seller.token, order.id, code)).statusCode).toBe(
        409,
      );
      expect(
        (await post(buyer.token, `/orders/${order.id}/confirm`)).statusCode,
      ).toBe(409);
    });

    it("can't be guessed: five tries, then a wait", async () => {
      const { order } = await paidOrder();
      const code = await codeOf(order.id);
      const wrong = code === "0000" ? "1111" : "0000";
      for (let i = 0; i < 5; i++) {
        expect((await handover(seller.token, order.id, wrong)).statusCode).toBe(
          400,
        );
      }
      expect((await handover(seller.token, order.id, code)).statusCode).toBe(
        429,
      );
      expect((await details(seller.token, order.id)).order.status).toBe("paid");
    });

    it("isn't needed when the buyer confirms themselves", async () => {
      const { order, conversation } = await paidOrder();
      expect(
        (await post(seller.token, `/orders/${order.id}/confirm`)).statusCode,
      ).toBe(404);

      const res = await post(buyer.token, `/orders/${order.id}/confirm`);
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json<OrderDetails>().order.status).toBe("completed");
      expect(await latestMessage(conversation.id)).toMatchObject({
        kind: "handover",
        senderId: buyer.id,
      });
      // No need to thank the buyer for their own tap
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(1));
      expect(pushedTo(BUYER_PUSH)).toEqual([]);
    });

    it("can't be used before the payment", async () => {
      const listing = await prisma.product.create({
        data: {
          sellerId: seller.id,
          categoryId,
          title: "Sac",
          price: 12000,
          images: { create: [{ path: "https://example.test/2.jpg" }] },
        },
      });
      const conversation = (
        await t.authed(buyer.token, {
          method: "POST",
          url: "/conversations",
          payload: { productId: listing.id },
        })
      ).json<Conversation>();
      const order = (
        await post(buyer.token, "/orders", {
          conversationId: conversation.id,
          fulfilment: "pickup",
        })
      ).json<Order>();
      expect((await handover(seller.token, order.id, "1234")).statusCode).toBe(
        409,
      );
      expect(
        (await post(buyer.token, `/orders/${order.id}/confirm`)).statusCode,
      ).toBe(409);
      expect(
        (await dispute(order.id, { reason: "not_received" })).statusCode,
      ).toBe(409);
      expect(
        (await post(seller.token, `/orders/${order.id}/refund`)).statusCode,
      ).toBe(409);
    });
  });

  describe("the seller's payout", () => {
    it("waits for an account, and leaves once the seller adds one", async () => {
      const { order } = await paidOrder();
      const res = await post(buyer.token, `/orders/${order.id}/confirm`);
      expect(res.statusCode).toBe(200);

      const waiting = (await details(seller.token, order.id)).transfer;
      expect(waiting).toMatchObject({
        status: "awaiting_account",
        provider: null,
        phone: null,
      });
      expect(t.payments.transfers).toEqual([]);
      await vi.waitFor(() =>
        expect(pushedTo(SELLER_PUSH)).toEqual([
          "Remise confirmée. Ajoute ton numéro Orange Money ou Moov Money pour recevoir 16 000 F.",
        ]),
      );

      const profile = await setPayoutAccount(seller.token);
      expect(profile.statusCode, profile.body).toBe(200);
      expect(profile.json<Profile>().payoutAccount).toEqual(SELLER_PAYOUT);
      expect(t.payments.transfers).toMatchObject([
        { transferId: waiting?.id, phone: SELLER_PAYOUT.phone, amount: 16000 },
      ]);
      expect((await details(seller.token, order.id)).transfer).toMatchObject({
        status: "pending",
        provider: "moov_money",
      });
    });

    it("is tried again later after a failure, and at once with a new number", async () => {
      await setPayoutAccount(seller.token);
      const { order } = await paidOrder();
      await handover(seller.token, order.id, await codeOf(order.id));
      const [first] = t.payments.transfers;
      t.push.sent.length = 0;

      await t.payments.answerTransfer(first?.transferId as string, {
        status: "failed",
        reason: "refused",
      });
      expect((await details(seller.token, order.id)).transfer).toMatchObject({
        status: "failed",
      });
      await vi.waitFor(() =>
        expect(pushedTo(SELLER_PUSH)).toEqual([
          "Le versement de 16 000 F n'est pas passé. Vérifie ton numéro de paiement dans ton profil.",
        ]),
      );

      // Not before its time
      await t.services.handover.runDue();
      expect(t.payments.transfers).toHaveLength(1);
      await later(15 * 60);
      expect(await t.services.handover.runDue()).toMatchObject({ sent: 1 });
      expect(t.payments.transfers).toHaveLength(2);

      // The seller fixes their number: sent at once
      await t.payments.answerTransfer(first?.transferId as string, {
        status: "failed",
        reason: "refused",
      });
      await setPayoutAccount(seller.token, {
        provider: "orange_money",
        phone: "+22370000011",
      });
      expect(t.payments.transfers.at(-1)).toMatchObject({
        provider: "orange_money",
        phone: "+22370000011",
      });
      expect(
        (
          await setPayoutAccount(seller.token, {
            provider: "orange_money",
            phone: "70000011",
          } as never)
        ).statusCode,
      ).toBe(400);
    });
  });

  describe("a reported problem", () => {
    it("keeps the money; the seller can refund the buyer", async () => {
      const { order, listing, conversation } = await paidOrder();

      // Not as described: show it
      expect(
        (await dispute(order.id, { reason: "not_as_described" })).statusCode,
      ).toBe(400);
      // Someone else's photo
      const othersPhoto = await uploadReportPhoto(outsider.token);
      expect(
        (
          await dispute(order.id, {
            reason: "not_as_described",
            photoPaths: [othersPhoto],
          })
        ).statusCode,
      ).toBe(400);
      // Only the buyer reports
      expect(
        (await dispute(order.id, { reason: "other" }, seller.token)).statusCode,
      ).toBe(404);

      const photo = await uploadReportPhoto();
      const res = await dispute(order.id, {
        reason: "not_as_described",
        note: "Taille 40, pas 42",
        photoPaths: [photo],
      });
      expect(res.statusCode, res.body).toBe(200);
      const reported = res.json<OrderDetails>();
      expect(reported.order.status).toBe("disputed");
      expect(reported.dispute).toMatchObject({
        reason: "not_as_described",
        note: "Taille 40, pas 42",
        photoPaths: [photo],
        status: "open",
      });
      // The seller sees it too
      expect((await details(seller.token, order.id)).dispute).toEqual(
        reported.dispute,
      );
      expect(await latestMessage(conversation.id)).toMatchObject({
        kind: "dispute",
        senderId: buyer.id,
        body: "Problème signalé : pas conforme à l'annonce",
      });
      await vi.waitFor(() =>
        expect(pushedTo(SELLER_PUSH)).toEqual([
          "Problème signalé : pas conforme à l'annonce. Dily garde l'argent en attendant.",
        ]),
      );
      expect(
        (await dispute(order.id, { reason: "not_received" })).statusCode,
      ).toBe(409);
      // Past the handover delay, Dily decides: no automatic refund
      await later(8 * DAY);
      expect(await t.services.handover.runDue()).toMatchObject({
        refunded: 0,
      });

      events.mockClear();
      t.push.sent.length = 0;
      expect(
        (await post(buyer.token, `/orders/${order.id}/refund`)).statusCode,
      ).toBe(404);
      const refund = await post(seller.token, `/orders/${order.id}/refund`);
      expect(refund.statusCode, refund.body).toBe(200);
      const buyerView = await details(buyer.token, order.id);
      expect(buyerView.order.status).toBe("refunded");
      expect(buyerView.order.refundedAt).not.toBeNull();
      expect(buyerView.dispute).toMatchObject({ status: "refunded" });
      // Back to the number that paid
      expect(buyerView.transfer).toMatchObject({
        kind: "refund",
        amount: 16000,
        provider: "orange_money",
        phone: BUYER_PHONE,
        status: "pending",
      });
      expect(t.payments.transfers.at(-1)).toMatchObject({
        provider: "orange_money",
        phone: BUYER_PHONE,
      });
      expect(sentTo(buyer.id, "transfer:updated")).toEqual([
        { transfer: buyerView.transfer },
      ]);
      expect(sentTo(seller.id, "transfer:updated")).toEqual([]);
      expect(await latestMessage(conversation.id)).toMatchObject({
        kind: "refund",
        body: "Remboursé : 16 000 F",
      });
      // The item never left: back on sale
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: listing.id } }))
          .status,
      ).toBe("active");
      await vi.waitFor(() =>
        expect(pushedTo(BUYER_PUSH)).toEqual([
          "Remboursement : 16 000 F reviennent sur ton Orange Money.",
        ]),
      );
      expect(pushedTo(SELLER_PUSH)).toEqual([]);
    });

    it("doesn't stop the handover: the code still settles it", async () => {
      await setPayoutAccount(seller.token);
      const { order } = await paidOrder();
      const code = await codeOf(order.id);
      await dispute(order.id, { reason: "not_received" });
      // Still the buyer's to give
      expect(await codeOf(order.id)).toBe(code);

      const res = await handover(seller.token, order.id, code);
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json<OrderDetails>()).toMatchObject({
        order: { status: "completed" },
        dispute: { status: "released" },
        transfer: { kind: "payout", status: "pending" },
      });
    });

    it("is settled by Dily: to the seller, or back to the buyer", async () => {
      await setPayoutAccount(seller.token);
      const first = await paidOrder();
      await dispute(first.order.id, { reason: "other", note: "Rien compris" });
      await t.services.handover.resolveDispute(first.order.id, "release");
      expect(await details(seller.token, first.order.id)).toMatchObject({
        order: { status: "completed" },
        dispute: { status: "released" },
        transfer: { kind: "payout" },
      });

      const second = await paidOrder();
      await dispute(second.order.id, { reason: "not_received" });
      await t.services.handover.resolveDispute(second.order.id, "refund");
      expect(await details(buyer.token, second.order.id)).toMatchObject({
        order: { status: "refunded" },
        dispute: { status: "refunded" },
        transfer: { kind: "refund", phone: BUYER_PHONE },
      });
      await expect(
        t.services.handover.resolveDispute(second.order.id, "release"),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("an item never handed over", () => {
    it("gets reminders after 2 and 5 days, then the buyer's money back after 7", async () => {
      const { order, listing } = await paidOrder();

      await later(DAY);
      expect(await t.services.handover.runDue()).toMatchObject({
        reminded: 0,
        refunded: 0,
      });
      await later(DAY);
      expect(await t.services.handover.runDue()).toMatchObject({
        reminded: 1,
      });
      // Once per reminder
      expect(await t.services.handover.runDue()).toMatchObject({
        reminded: 0,
      });
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(2));
      expect(pushedTo(SELLER_PUSH)[0]).toMatch(
        /^Remets « Nike Air Force 1 » à Awa et saisis son code de remise pour être payé\. Sans remise d'ici .+, Awa récupère son argent\.$/,
      );
      expect(pushedTo(BUYER_PUSH)[0]).toMatch(
        /^Garde ton code de remise pour « Nike Air Force 1 »\. Rien reçu d'ici .+ : ton argent te revient automatiquement\.$/,
      );

      await later(3 * DAY);
      expect(await t.services.handover.runDue()).toMatchObject({
        reminded: 1,
        refunded: 0,
      });
      t.push.sent.length = 0;
      await later(2 * DAY);
      expect(await t.services.handover.runDue()).toMatchObject({
        refunded: 1,
      });
      expect(await details(buyer.token, order.id)).toMatchObject({
        order: { status: "refunded" },
        handoverCode: null,
        transfer: { kind: "refund", amount: 16000, phone: BUYER_PHONE },
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: listing.id } }))
          .status,
      ).toBe("active");
      await vi.waitFor(() => expect(t.push.sent).toHaveLength(2));
      expect(pushedTo(BUYER_PUSH)).toEqual([
        "L'article n'a pas été remis à temps : 16 000 F reviennent sur ton Orange Money.",
      ]);
      expect(pushedTo(SELLER_PUSH)).toEqual([
        "L'article n'a pas été remis à temps : Awa récupère son argent. Ton annonce est de nouveau en vente.",
      ]);
      // Too late for the code
      expect((await handover(seller.token, order.id, "1234")).statusCode).toBe(
        409,
      );
      expect(await t.services.handover.runDue()).toMatchObject({
        refunded: 0,
      });
    });
  });
});
