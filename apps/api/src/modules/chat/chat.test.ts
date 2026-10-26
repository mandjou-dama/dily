import {
  MESSAGES_PAGE_SIZE,
  type ChatMessage,
  type Conversation,
  type ConversationPage,
  type ConversationReadEvent,
  type MessageNewEvent,
  type MessagePage,
  type RealtimeConnectError,
} from "@dily/shared";
import { randomUUID } from "node:crypto";
import { io as ioClient, type Socket } from "socket.io-client";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
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

const SELLER_TOKEN = "ExponentPushToken[seller-phone]";
const BUYER_TOKEN = "ExponentPushToken[buyer-phone]";

describe.skipIf(!hasTestServices)("chat", () => {
  const prisma = hasTestServices ? createTestPrisma() : (undefined as never);
  const redis = hasTestServices ? createTestRedis() : (undefined as never);
  let t: TestApp;
  let seller: { id: string; token: string };
  let buyer: { id: string; token: string };
  let outsider: { id: string; token: string };
  let categoryId: number;

  beforeEach(async () => {
    await resetState(prisma, redis);
    t = await createTestApp(prisma, redis);
    const signIn = async (phone: `+223${string}`, fullName: string) => {
      const session = await t.login(phone);
      await prisma.user.update({
        where: { id: session.userId },
        data: { fullName },
      });
      return { id: session.userId, token: session.accessToken };
    };
    seller = await signIn("+22370000001", "Awa Traoré");
    buyer = await signIn("+22370000002", "Moussa Keita");
    outsider = await signIn("+22370000003", "Fanta Diallo");
    categoryId = (await createCategory(prisma)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  const createListing = (
    title = "Nike Air",
    status: "active" | "sold" | "archived" = "active",
  ) =>
    prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        title,
        price: 15000,
        status,
        images: { create: [{ path: "https://example.test/1.jpg" }] },
      },
    });

  const open = (token: string, productId: string) =>
    t.authed(token, {
      method: "POST",
      url: "/conversations",
      payload: { productId },
    });

  const openConversation = async (token: string, productId: string) =>
    (await open(token, productId)).json<Conversation>();

  const send = (
    token: string,
    conversationId: string,
    body: string,
    id: string = randomUUID(),
  ) =>
    t.authed(token, {
      method: "POST",
      url: `/conversations/${conversationId}/messages`,
      payload: { id, body },
    });

  const get = async <T>(token: string, url: string) =>
    (await t.authed(token, { method: "GET", url })).json<T>();

  const unreadCount = async (token: string) =>
    (await get<{ count: number }>(token, "/conversations/unread-count")).count;

  const registerPushToken = (token: string, pushToken: string) =>
    t.authed(token, {
      method: "PUT",
      url: "/me/push-token",
      payload: { token: pushToken, platform: "ios" },
    });

  describe("conversations", () => {
    it("starts one conversation per listing and buyer", async () => {
      const listing = await createListing();

      const first = await open(buyer.token, listing.id);
      expect(first.statusCode).toBe(200);
      const conversation = first.json<Conversation>();
      expect(conversation).toMatchObject({
        product: {
          id: listing.id,
          title: "Nike Air",
          price: 15000,
          status: "active",
          imagePath: "https://example.test/1.jpg",
        },
        otherUser: { id: seller.id, name: "Awa Traoré" },
        role: "buyer",
        lastMessage: null,
        unreadCount: 0,
      });

      const again = await openConversation(buyer.token, listing.id);
      expect(again.id).toBe(conversation.id);
      expect(await prisma.conversation.count()).toBe(1);
    });

    it("refuses the seller's own listing, and new conversations on sold or hidden ones", async () => {
      const listing = await createListing();
      const sold = await createListing("Sold bag", "sold");
      const hidden = await createListing("Hidden hat", "archived");

      const own = await open(seller.token, listing.id);
      expect(own.statusCode).toBe(403);
      expect((await open(buyer.token, sold.id)).statusCode).toBe(403);
      expect((await open(buyer.token, hidden.id)).statusCode).toBe(404);
      expect((await open(buyer.token, randomUUID())).statusCode).toBe(404);
    });

    it("keeps a conversation going after the listing is sold", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      await prisma.product.update({
        where: { id: listing.id },
        data: { status: "sold" },
      });

      const reopened = await openConversation(buyer.token, listing.id);
      expect(reopened).toMatchObject({
        id: conversation.id,
        product: { status: "sold" },
      });
      expect(
        (await send(buyer.token, conversation.id, "Still here?")).statusCode,
      ).toBe(201);
    });

    it("lists conversations with a message, latest first, for both sides", async () => {
      const shoes = await createListing("Shoes");
      const bag = await createListing("Bag");
      const hat = await createListing("Hat");
      const aboutShoes = await openConversation(buyer.token, shoes.id);
      const aboutBag = await openConversation(buyer.token, bag.id);
      // Opened but never written to: nobody sees it in their list
      await openConversation(buyer.token, hat.id);

      await send(buyer.token, aboutShoes.id, "Hello for the shoes");
      t.advance(60);
      await send(buyer.token, aboutBag.id, "Hello for the bag");

      const mine = await get<ConversationPage>(buyer.token, "/conversations");
      expect(mine.items.map((c) => c.product.title)).toEqual(["Bag", "Shoes"]);
      expect(mine.nextCursor).toBeNull();

      const theirs = await get<ConversationPage>(
        seller.token,
        "/conversations",
      );
      expect(theirs.items.map((c) => c.id)).toEqual([
        aboutBag.id,
        aboutShoes.id,
      ]);
      expect(theirs.items[0]).toMatchObject({
        role: "seller",
        otherUser: { id: buyer.id, name: "Moussa Keita" },
        lastMessage: { body: "Hello for the bag", senderId: buyer.id },
        unreadCount: 1,
      });
    });

    it("hides conversations from people outside them", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      await send(buyer.token, conversation.id, "Hi");

      const base = `/conversations/${conversation.id}`;
      const attempts = await Promise.all([
        t.authed(outsider.token, { method: "GET", url: base }),
        t.authed(outsider.token, { method: "GET", url: `${base}/messages` }),
        send(outsider.token, conversation.id, "Let me in"),
        t.authed(outsider.token, { method: "POST", url: `${base}/read` }),
      ]);
      expect(attempts.map((res) => res.statusCode)).toEqual([
        404, 404, 404, 404,
      ]);
      expect(
        (await get<ConversationPage>(outsider.token, "/conversations")).items,
      ).toEqual([]);
    });
  });

  describe("messages", () => {
    it("saves a message once, even when the app sends it again", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const id = randomUUID();

      const first = await send(
        buyer.token,
        conversation.id,
        "  Is it new?  ",
        id,
      );
      expect(first.statusCode).toBe(201);
      expect(first.json<ChatMessage>()).toMatchObject({
        id,
        conversationId: conversation.id,
        senderId: buyer.id,
        body: "Is it new?",
        readAt: null,
      });

      const retry = await send(buyer.token, conversation.id, "Is it new?", id);
      expect(retry.statusCode).toBe(201);
      expect(retry.json<ChatMessage>()).toEqual(first.json());
      expect(await prisma.message.count()).toBe(1);

      // The same id can't land in another conversation
      const other = await openConversation(
        buyer.token,
        (await createListing("Other")).id,
      );
      expect((await send(buyer.token, other.id, "Hi", id)).statusCode).toBe(
        400,
      );
    });

    it("refuses empty and oversized messages", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      expect((await send(buyer.token, conversation.id, "   ")).statusCode).toBe(
        400,
      );
      expect(
        (await send(buyer.token, conversation.id, "a".repeat(4001))).statusCode,
      ).toBe(400);
    });

    it("pages the history newest first", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const start = Date.now();
      await prisma.message.createMany({
        data: Array.from({ length: MESSAGES_PAGE_SIZE + 5 }, (_, i) => ({
          conversationId: conversation.id,
          senderId: i % 2 ? seller.id : buyer.id,
          body: `Message ${i}`,
          createdAt: new Date(start + i * 1000),
        })),
      });

      const url = `/conversations/${conversation.id}/messages`;
      const first = await get<MessagePage>(seller.token, url);
      expect(first.items).toHaveLength(MESSAGES_PAGE_SIZE);
      expect(first.items[0]?.body).toBe(`Message ${MESSAGES_PAGE_SIZE + 4}`);
      expect(first.nextCursor).not.toBeNull();

      const second = await get<MessagePage>(
        seller.token,
        `${url}?cursor=${first.nextCursor}`,
      );
      expect(second.items.map((m) => m.body)).toEqual([
        "Message 4",
        "Message 3",
        "Message 2",
        "Message 1",
        "Message 0",
      ]);
      expect(second.nextCursor).toBeNull();
    });

    it("marks the other person's messages read", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      await send(buyer.token, conversation.id, "Hello");
      await send(buyer.token, conversation.id, "Still available?");
      await send(seller.token, conversation.id, "Yes!");

      expect(await unreadCount(seller.token)).toBe(2);
      expect(await unreadCount(buyer.token)).toBe(1);

      const read = await t.authed(seller.token, {
        method: "POST",
        url: `/conversations/${conversation.id}/read`,
      });
      expect(read.statusCode).toBe(204);
      expect(await unreadCount(seller.token)).toBe(0);
      // The seller's own reply stays unread for the buyer
      expect(await unreadCount(buyer.token)).toBe(1);

      const page = await get<MessagePage>(
        buyer.token,
        `/conversations/${conversation.id}/messages`,
      );
      const readAt = Object.fromEntries(
        page.items.map((m) => [m.body, m.readAt]),
      );
      expect(readAt["Hello"]).not.toBeNull();
      expect(readAt["Still available?"]).not.toBeNull();
      expect(readAt["Yes!"]).toBeNull();
    });

    it("limits how fast one user can send", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      for (let i = 0; i < 30; i++) {
        expect(
          (await send(buyer.token, conversation.id, `Spam ${i}`)).statusCode,
        ).toBe(201);
      }
      const blocked = await send(buyer.token, conversation.id, "One more");
      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers["retry-after"]).toBeDefined();
    });
  });

  describe("push notifications", () => {
    it("notifies the recipient's devices with who wrote and what", async () => {
      await registerPushToken(seller.token, SELLER_TOKEN);
      await registerPushToken(buyer.token, BUYER_TOKEN);
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);

      await send(buyer.token, conversation.id, "Can you do 12 000?");

      await vi.waitFor(() => expect(t.push.sent).toHaveLength(1));
      expect(t.push.sent[0]).toEqual({
        to: SELLER_TOKEN,
        title: "Moussa Keita",
        body: "Can you do 12 000?",
        data: { type: "message", conversationId: conversation.id },
      });
    });

    it("keeps one owner per token and forgets uninstalled devices", async () => {
      await registerPushToken(buyer.token, SELLER_TOKEN);
      // Same phone, now signed in as the seller
      expect(
        (await registerPushToken(seller.token, SELLER_TOKEN)).statusCode,
      ).toBe(204);
      expect(
        await prisma.pushToken.findMany({ select: { userId: true } }),
      ).toEqual([{ userId: seller.id }]);

      t.push.unregistered.add(SELLER_TOKEN);
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      await send(buyer.token, conversation.id, "Hi");
      await vi.waitFor(async () =>
        expect(await prisma.pushToken.count()).toBe(0),
      );
    });

    it("stops notifying a device once it signs out", async () => {
      await registerPushToken(seller.token, SELLER_TOKEN);
      const removed = await t.authed(seller.token, {
        method: "DELETE",
        url: "/me/push-token",
        payload: { token: SELLER_TOKEN },
      });
      expect(removed.statusCode).toBe(204);
      expect(await prisma.pushToken.count()).toBe(0);
    });

    it("refuses something that isn't an Expo push token", async () => {
      const res = await registerPushToken(seller.token, "not-a-token");
      expect(res.statusCode).toBe(400);
    });
  });

  describe("realtime", () => {
    let url: string;
    const sockets: Socket[] = [];

    beforeEach(async () => {
      url = await t.listen();
    });

    afterEach(async () => {
      for (const socket of sockets.splice(0)) socket.close();
      await t.app.close();
    });

    function connect(token?: string) {
      const socket = ioClient(url, {
        transports: ["websocket"],
        auth: token ? { token } : {},
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      return socket;
    }

    const connected = (socket: Socket) =>
      new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });

    /** Lets the server finish joining rooms and the events arrive. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

    it("refuses a connection without a valid access token", async () => {
      for (const socket of [connect(), connect("not-a-jwt")]) {
        const error = await new Promise<RealtimeConnectError>(
          (resolve, reject) => {
            socket.once("connect", () => reject(new Error("accepted")));
            socket.once("connect_error", (err) =>
              resolve((err as { data: RealtimeConnectError }).data),
            );
          },
        );
        expect(error).toMatchObject({ error: "unauthorized" });
      }
    });

    it("sends a new message to both participants' devices only", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      const devices = {
        sellerPhone: connect(seller.token),
        sellerTablet: connect(seller.token),
        buyerPhone: connect(buyer.token),
        outsiderPhone: connect(outsider.token),
      };
      await Promise.all(Object.values(devices).map(connected));
      await settle();

      const received: Record<string, MessageNewEvent[]> = {};
      for (const [name, socket] of Object.entries(devices)) {
        received[name] = [];
        socket.on("message:new", (event: MessageNewEvent) =>
          received[name]?.push(event),
        );
      }

      const message = (
        await send(buyer.token, conversation.id, "Hello")
      ).json<ChatMessage>();
      await settle();

      expect(received).toEqual({
        sellerPhone: [{ message }],
        sellerTablet: [{ message }],
        buyerPhone: [{ message }],
        outsiderPhone: [],
      });
    });

    it("tells the sender when their messages are read", async () => {
      const listing = await createListing();
      const conversation = await openConversation(buyer.token, listing.id);
      await send(buyer.token, conversation.id, "Hello");
      const buyerPhone = connect(buyer.token);
      await connected(buyerPhone);
      await settle();

      const events: ConversationReadEvent[] = [];
      buyerPhone.on("conversation:read", (event: ConversationReadEvent) =>
        events.push(event),
      );
      await t.authed(seller.token, {
        method: "POST",
        url: `/conversations/${conversation.id}/read`,
      });
      // Nothing new to read: no second event
      await t.authed(seller.token, {
        method: "POST",
        url: `/conversations/${conversation.id}/read`,
      });
      await settle();

      expect(events).toEqual([
        {
          conversationId: conversation.id,
          readerId: seller.id,
          readAt: expect.any(String),
        },
      ]);
    });
  });
});
