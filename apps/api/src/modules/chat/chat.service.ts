import {
  CONVERSATIONS_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
  type ChatMessage,
  type Conversation,
  type ConversationPage,
  type ConversationReadEvent,
  type MessagePage,
  type MessagePushData,
} from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { decodeCursor, encodeCursor, toPage } from "../../lib/cursor.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import type { PushService } from "../notifications/push.service.js";
import { toOffer, toOrder } from "../offers/offer-rows.js";
import type { UserNotifier } from "../realtime/notifier.js";

/** New conversations per user, far above a real buyer's pace: bounds spam. */
export const NEW_CONVERSATION_RATE_LIMIT: RateLimitRule = {
  max: 30,
  windowSeconds: 3600,
};

/** Messages per user, retries included. */
export const MESSAGE_RATE_LIMIT: RateLimitRule = { max: 30, windowSeconds: 60 };

// Lock screens cut long texts anyway
const PUSH_PREVIEW_LENGTH = 140;

const PERSON_SELECT = {
  id: true,
  fullName: true,
  avatarPath: true,
  neighbourhood: true,
  city: true,
} satisfies Prisma.UserSelect;

/** "Badalabougou, Bamako", or just the city. */
const locationOf = (person: { neighbourhood: string | null; city: string }) =>
  [person.neighbourhood, person.city].filter(Boolean).join(", ");

/** What a message brings along: its offer or its order, as they stand now. */
export const MESSAGE_INCLUDE = {
  offer: true,
  order: true,
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

const NEWEST_FIRST = [
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.MessageOrderByWithRelationInput[];

export const participantOf = (userId: string) =>
  ({
    OR: [{ buyerId: userId }, { sellerId: userId }],
  }) satisfies Prisma.ConversationWhereInput;

/** Messages the user hasn't read yet: the other person's, without `readAt`. */
const unreadBy = (userId: string) =>
  ({
    readAt: null,
    senderId: { not: userId },
  }) satisfies Prisma.MessageWhereInput;

const conversationSelect = (userId: string) =>
  ({
    id: true,
    buyerId: true,
    lastMessageAt: true,
    product: {
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        pickup: true,
        deliveryFee: true,
        images: {
          select: { path: true },
          orderBy: { position: "asc" },
          take: 1,
        },
        // Who the listing is held for, if anyone
        orders: {
          where: { status: "awaiting_payment" },
          select: { conversationId: true, reservedUntil: true },
        },
      },
    },
    buyer: { select: PERSON_SELECT },
    seller: { select: PERSON_SELECT },
    messages: { orderBy: NEWEST_FIRST, take: 1, include: MESSAGE_INCLUDE },
    offers: { orderBy: NEWEST_FIRST, take: 1 },
    orders: { orderBy: NEWEST_FIRST, take: 1 },
    _count: { select: { messages: { where: unreadBy(userId) } } },
  }) satisfies Prisma.ConversationSelect;

type ConversationRow = Prisma.ConversationGetPayload<{
  select: ReturnType<typeof conversationSelect>;
}>;

export const toChatMessage = (message: MessageRow, now: Date): ChatMessage => ({
  id: message.id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  kind: message.kind,
  body: message.body,
  offer: message.offer ? toOffer(message.offer, now) : null,
  order: message.order ? toOrder(message.order, now) : null,
  createdAt: message.createdAt.toISOString(),
  readAt: message.readAt?.toISOString() ?? null,
});

function toConversation(
  userId: string,
  row: ConversationRow,
  now: Date,
): Conversation {
  const isBuyer = row.buyerId === userId;
  const other = isBuyer ? row.seller : row.buyer;
  const last = row.messages[0];
  const offer = row.offers[0];
  const order = row.orders[0];
  const heldElsewhere = row.product.orders.find(
    (o) => o.conversationId !== row.id && o.reservedUntil > now,
  );
  return {
    id: row.id,
    product: {
      id: row.product.id,
      title: row.product.title,
      price: row.product.price,
      status: row.product.status,
      imagePath: row.product.images[0]?.path ?? null,
      pickup: row.product.pickup,
      deliveryFee: row.product.deliveryFee,
    },
    otherUser: {
      id: other.id,
      name: other.fullName ?? "Dily",
      avatarPath: other.avatarPath,
      location: locationOf(other),
    },
    role: isBuyer ? "buyer" : "seller",
    lastMessage: last ? toChatMessage(last, now) : null,
    unreadCount: row._count.messages,
    deal: {
      offer: offer ? toOffer(offer, now) : null,
      order: order ? toOrder(order, now) : null,
      reservedElsewhereUntil:
        heldElsewhere?.reservedUntil.toISOString() ?? null,
    },
  };
}

const preview = (body: string) =>
  body.length > PUSH_PREVIEW_LENGTH
    ? `${body.slice(0, PUSH_PREVIEW_LENGTH - 1).trimEnd()}…`
    : body;

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const conversationNotFound = () =>
  notFound("This conversation doesn't exist.");

export interface ChatServiceDeps {
  prisma: PrismaClient;
  notifier: UserNotifier;
  push: PushService;
  rateLimiter: RateLimiter;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

/**
 * Buyer–seller conversations, one per listing and buyer. Messages go in
 * through HTTP; both participants' devices get them over Socket.IO, and the
 * recipient also gets a push notification.
 */
export class ChatService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: ChatServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
  }

  /** "Message the seller": the buyer's conversation about this listing, started if needed. */
  async open(userId: string, productId: string): Promise<Conversation> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true, status: true },
    });
    if (!product) throw notFound("This listing isn't available.");
    if (product.sellerId === userId) {
      throw new AppError(403, "forbidden", "This is your own listing.");
    }

    const existing = await this.findByProduct(userId, productId);
    // Sold or hidden later: the conversation already started goes on
    if (existing) return existing;
    if (product.status === "archived") {
      throw notFound("This listing isn't available.");
    }
    if (product.status === "sold") {
      throw new AppError(403, "forbidden", "This item is already sold.");
    }

    await this.deps.rateLimiter.consume(
      `chat:conversation:user:${userId}`,
      NEW_CONVERSATION_RATE_LIMIT,
    );
    try {
      const row = await this.prisma.conversation.create({
        data: { productId, buyerId: userId, sellerId: product.sellerId },
        select: conversationSelect(userId),
      });
      return toConversation(userId, row, this.now());
    } catch (error) {
      // Two taps at once: the other request created it
      if (isUniqueViolation(error)) {
        const created = await this.findByProduct(userId, productId);
        if (created) return created;
      }
      throw error;
    }
  }

  async get(userId: string, conversationId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, ...participantOf(userId) },
      select: conversationSelect(userId),
    });
    if (!row) throw conversationNotFound();
    return toConversation(userId, row, this.now());
  }

  /** The user's conversations, latest message first; empty ones are left out. */
  async list(userId: string, cursor?: string): Promise<ConversationPage> {
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.conversation.findMany({
      where: {
        AND: [
          participantOf(userId),
          { lastMessageAt: { not: null } },
          ...(after
            ? [
                {
                  OR: [
                    { lastMessageAt: { lt: after.date } },
                    { lastMessageAt: after.date, id: { lt: after.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: CONVERSATIONS_PAGE_SIZE + 1,
      select: conversationSelect(userId),
    });
    const now = this.now();
    return toPage(
      rows,
      CONVERSATIONS_PAGE_SIZE,
      (row) => toConversation(userId, row, now),
      // Never null here: empty conversations are filtered out
      (row) => encodeCursor(row.lastMessageAt ?? new Date(0), row.id),
    );
  }

  /** A conversation's messages, newest first. */
  async messages(
    userId: string,
    conversationId: string,
    cursor?: string,
  ): Promise<MessagePage> {
    await this.participants(userId, conversationId);
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.date } },
                { createdAt: after.date, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: NEWEST_FIRST,
      take: MESSAGES_PAGE_SIZE + 1,
      include: MESSAGE_INCLUDE,
    });
    const now = this.now();
    return toPage(
      rows,
      MESSAGES_PAGE_SIZE,
      (row) => toChatMessage(row, now),
      (row) => encodeCursor(row.createdAt, row.id),
    );
  }

  /**
   * Saves a message under the id the app generated, then sends it to both
   * participants' devices and notifies the recipient. Sending the same id
   * again (retry after a network error) returns the saved message as is.
   */
  async send(
    userId: string,
    conversationId: string,
    input: { id: string; body: string },
  ): Promise<ChatMessage> {
    const { buyerId, sellerId } = await this.participants(
      userId,
      conversationId,
    );
    await this.deps.rateLimiter.consume(
      `chat:message:user:${userId}`,
      MESSAGE_RATE_LIMIT,
    );

    let message: MessageRow;
    try {
      message = await this.prisma.message.create({
        data: {
          id: input.id,
          conversationId,
          senderId: userId,
          body: input.body,
          createdAt: this.now(),
        },
        include: MESSAGE_INCLUDE,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const saved = await this.prisma.message.findUnique({
        where: { id: input.id },
        include: MESSAGE_INCLUDE,
      });
      if (
        saved?.senderId === userId &&
        saved.conversationId === conversationId
      ) {
        return toChatMessage(saved, this.now());
      }
      throw new AppError(400, "validation_error", "Invalid message id.");
    }

    const chatMessage = toChatMessage(message, this.now());
    const recipientId = buyerId === userId ? sellerId : buyerId;
    for (const id of [recipientId, userId]) {
      this.deps.notifier.send(id, "message:new", { message: chatMessage });
    }
    // Expo can take a while: the message is saved, don't make the sender wait
    void this.pushMessage(recipientId, chatMessage);
    return chatMessage;
  }

  /** Marks the other person's messages read, and tells both participants' devices. */
  async markRead(userId: string, conversationId: string): Promise<void> {
    const { buyerId, sellerId } = await this.participants(
      userId,
      conversationId,
    );
    const readAt = this.now();
    const { count } = await this.prisma.message.updateMany({
      where: { conversationId, ...unreadBy(userId) },
      data: { readAt },
    });
    if (count === 0) return;

    const event: ConversationReadEvent = {
      conversationId,
      readerId: userId,
      readAt: readAt.toISOString(),
    };
    for (const id of [buyerId, sellerId]) {
      this.deps.notifier.send(id, "conversation:read", event);
    }
  }

  /** Unread messages across all conversations: the Chat tab's badge. */
  unreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: { ...unreadBy(userId), conversation: participantOf(userId) },
    });
  }

  private async findByProduct(
    userId: string,
    productId: string,
  ): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findUnique({
      where: { productId_buyerId: { productId, buyerId: userId } },
      select: conversationSelect(userId),
    });
    return row ? toConversation(userId, row, this.now()) : null;
  }

  /** 404 unless the user takes part in the conversation: others can't tell it exists. */
  private async participants(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, ...participantOf(userId) },
      select: { buyerId: true, sellerId: true },
    });
    if (!conversation) throw conversationNotFound();
    return conversation;
  }

  private async pushMessage(
    recipientId: string,
    message: ChatMessage,
  ): Promise<void> {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: message.senderId },
        select: { fullName: true },
      });
      const data: MessagePushData = {
        type: "message",
        conversationId: message.conversationId,
      };
      await this.deps.push.sendToUser(recipientId, {
        title: sender?.fullName ?? "Dily",
        body: preview(message.body),
        data,
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, recipientId },
        "chat: message notification failed",
      );
    }
  }
}
