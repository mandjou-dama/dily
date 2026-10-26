import {
  listedTotal,
  OFFER_TTL_HOURS,
  RESERVATION_HOURS,
  type AcceptedOffer,
  type ChatMessage,
  type Fulfilment,
  type MessagePushData,
  type Offer,
  type offerBodySchema,
} from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";
import type {
  Offer as OfferRow,
  Order as OrderRow,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { AppError, notFound } from "../../lib/errors.js";
import { formatPrice } from "../../lib/format.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import {
  conversationNotFound,
  isUniqueViolation,
  MESSAGE_INCLUDE,
  participantOf,
  toChatMessage,
} from "../chat/chat.service.js";
import type { PushService } from "../notifications/push.service.js";
import type { UserNotifier } from "../realtime/notifier.js";
import { offerStatusAt, toOffer, toOrder } from "./offer-rows.js";
import {
  announceExpired,
  buyerTerms,
  expireLapsedOrders,
  openOrdersOf,
  reservedElsewhere,
  unavailable,
} from "./terms.js";

export type OfferInput = z.output<typeof offerBodySchema>;

/** Offers per user, counter-offers and retries included: bounds spam. */
export const OFFER_RATE_LIMIT: RateLimitRule = { max: 30, windowSeconds: 3600 };

const HOUR_MS = 3600 * 1000;

// Message texts, in French like the screens: conversation list previews and
// notifications show them
const offerSummary = ({ amount, fulfilment }: OfferRow) =>
  `Offre : ${formatPrice(amount)} F, ${fulfilment === "delivery" ? "livraison comprise" : "retrait"}`;
const dealSummary = ({ amount, fulfilment }: OrderRow) =>
  `Marché conclu : ${formatPrice(amount)} F${fulfilment === "delivery" ? ", livraison comprise" : ""}`;
const declinedSummary = ({ amount }: OfferRow) =>
  `Offre de ${formatPrice(amount)} F refusée`;

const conflict = (message: string) => new AppError(409, "conflict", message);
const offerNotFound = () => notFound("This offer doesn't exist.");
const offerClosed = () => conflict("This offer is no longer open.");
const justChanged = () =>
  conflict("The negotiation just changed. Check the conversation first.");

export interface OffersServiceDeps {
  prisma: PrismaClient;
  notifier: UserNotifier;
  push: PushService;
  rateLimiter: RateLimiter;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

/**
 * Negotiating in a conversation: the buyer offers a total price with pickup
 * or delivery, either side answers with a counter-offer, and accepting one
 * starts the order and holds the listing for the buyer. Offers live in the
 * conversation as messages; status changes reach both participants' devices
 * as `offer:updated`, and the other person gets a notification.
 */
export class OffersService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: OffersServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * An offer, or a counter-offer. The buyer picks pickup or delivery among
   * what the listing allows; the seller can only answer a pending offer, and
   * keeps its way of getting the item. A new offer replaces the pending one,
   * and the buyer's cancels an agreement not paid yet. Sending the same id
   * again returns the saved offer.
   */
  async create(
    userId: string,
    conversationId: string,
    input: OfferInput,
  ): Promise<ChatMessage> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, ...participantOf(userId) },
      select: {
        buyerId: true,
        sellerId: true,
        productId: true,
        buyer: { select: { city: true } },
        seller: { select: { city: true } },
        product: {
          select: {
            price: true,
            status: true,
            pickup: true,
            deliveryFee: true,
          },
        },
      },
    });
    if (!conversation) throw conversationNotFound();

    const saved = await this.prisma.offer.findUnique({
      where: { id: input.id },
      include: { message: { include: MESSAGE_INCLUDE } },
    });
    if (saved) {
      if (
        saved.authorId === userId &&
        saved.conversationId === conversationId &&
        saved.message
      ) {
        return toChatMessage(saved.message, this.now());
      }
      throw new AppError(400, "validation_error", "Invalid offer id.");
    }

    await this.deps.rateLimiter.consume(
      `offer:user:${userId}`,
      OFFER_RATE_LIMIT,
    );

    const now = this.now();
    const { buyerId, sellerId, productId, product } = conversation;
    const isBuyer = userId === buyerId;
    if (product.status !== "active") throw unavailable();

    const [pending, openOrders] = await Promise.all([
      this.prisma.offer.findFirst({
        where: { conversationId, status: "pending" },
      }),
      openOrdersOf(this.prisma, productId, now),
    ]);
    if (openOrders.some((o) => o.conversationId !== conversationId)) {
      throw reservedElsewhere();
    }
    const ownOrder = openOrders.find(
      (o) => o.conversationId === conversationId,
    );
    if (ownOrder?.status === "paid") throw unavailable();

    let terms: {
      fulfilment: Fulfilment;
      deliveryFee: number | null;
      deliveryArea: string | null;
      listPrice: number;
    };
    if (isBuyer) {
      terms = {
        ...buyerTerms(input, product, conversation),
        listPrice: product.price,
      };
    } else {
      const answering =
        pending && offerStatusAt(pending, now) === "pending" ? pending : null;
      if (!answering) {
        throw conflict("You can answer an offer, not start one.");
      }
      if (input.fulfilment !== answering.fulfilment) {
        throw new AppError(
          400,
          "validation_error",
          "A counter-offer keeps pickup or delivery as the buyer chose.",
        );
      }
      terms = {
        fulfilment: answering.fulfilment,
        deliveryFee: answering.deliveryFee,
        deliveryArea: answering.deliveryArea,
        listPrice: answering.listPrice,
      };
    }
    if (input.amount > listedTotal(terms)) {
      throw new AppError(
        400,
        "validation_error",
        "An offer can't be more than the listed price.",
      );
    }

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // The pending offer gives way: expired if its time is up. Answered
        // meanwhile, it's no longer the one this offer replaces
        let replaced: OfferRow | null = null;
        if (pending) {
          const status =
            offerStatusAt(pending, now) === "expired"
              ? "expired"
              : "superseded";
          const { count } = await tx.offer.updateMany({
            where: { id: pending.id, status: "pending" },
            data: { status },
          });
          if (count === 0) throw justChanged();
          replaced = { ...pending, status };
        }
        // Only the buyer gets here with an order waiting for payment
        let cancelled: OrderRow | null = null;
        if (ownOrder?.status === "awaiting_payment") {
          const { count } = await tx.order.updateMany({
            where: { id: ownOrder.id, status: "awaiting_payment" },
            data: { status: "cancelled" },
          });
          if (count === 0) throw justChanged();
          cancelled = { ...ownOrder, status: "cancelled" };
        }
        const offer = await tx.offer.create({
          data: {
            id: input.id,
            conversationId,
            authorId: userId,
            amount: input.amount,
            ...terms,
            expiresAt: new Date(now.getTime() + OFFER_TTL_HOURS * HOUR_MS),
            createdAt: now,
          },
        });
        const message = await tx.message.create({
          data: {
            conversationId,
            senderId: userId,
            kind: "offer",
            body: offerSummary(offer),
            offerId: offer.id,
            createdAt: now,
          },
          include: MESSAGE_INCLUDE,
        });
        return { message, replaced, cancelled };
      });
    } catch (error) {
      // Both sides sent an offer at the same moment: the other one won
      if (isUniqueViolation(error)) {
        throw conflict("Another offer was just sent. Check it first.");
      }
      throw error;
    }

    const participants = [buyerId, sellerId];
    const chatMessage = toChatMessage(created.message, now);
    for (const id of participants) {
      this.deps.notifier.send(id, "message:new", { message: chatMessage });
      if (created.replaced) {
        this.deps.notifier.send(id, "offer:updated", {
          offer: toOffer(created.replaced, now),
        });
      }
      if (created.cancelled) {
        this.deps.notifier.send(id, "order:updated", {
          order: toOrder(created.cancelled, now),
        });
      }
    }
    void this.notify(
      isBuyer ? sellerId : buyerId,
      userId,
      conversationId,
      chatMessage.body,
    );
    return chatMessage;
  }

  /**
   * The other person accepts: the order starts, waiting for payment, and
   * the listing is held for the buyer until it's paid or the time is up.
   */
  async accept(userId: string, offerId: string): Promise<AcceptedOffer> {
    const offer = await this.answerable(userId, offerId);
    const { conversation } = offer;
    if (conversation.product.status !== "active") throw unavailable();

    const now = this.now();
    let accepted;
    try {
      accepted = await this.prisma.$transaction(async (tx) => {
        // Unpaid in time: the listing is free again
        const lapsed = await expireLapsedOrders(
          tx,
          conversation.productId,
          now,
        );
        const { count } = await tx.offer.updateMany({
          where: { id: offerId, status: "pending", expiresAt: { gt: now } },
          data: { status: "accepted", respondedAt: now },
        });
        if (count === 0) throw offerClosed();

        const order = await tx.order.create({
          data: {
            conversationId: conversation.id,
            productId: conversation.productId,
            buyerId: conversation.buyerId,
            sellerId: conversation.sellerId,
            offerId,
            amount: offer.amount,
            listPrice: offer.listPrice,
            fulfilment: offer.fulfilment,
            deliveryFee: offer.deliveryFee,
            deliveryArea: offer.deliveryArea,
            reservedUntil: new Date(
              now.getTime() + RESERVATION_HOURS * HOUR_MS,
            ),
            createdAt: now,
          },
        });
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            kind: "deal",
            body: dealSummary(order),
            orderId: order.id,
            createdAt: now,
          },
          include: MESSAGE_INCLUDE,
        });
        const saved = await tx.offer.findUniqueOrThrow({
          where: { id: offerId },
        });
        return { offer: saved, order, message, lapsed };
      });
    } catch (error) {
      // Another buyer's agreement got there first
      if (isUniqueViolation(error)) throw reservedElsewhere();
      throw error;
    }

    const result: AcceptedOffer = {
      offer: toOffer(accepted.offer, now),
      order: toOrder(accepted.order, now),
    };
    const chatMessage = toChatMessage(accepted.message, now);
    for (const id of [conversation.buyerId, conversation.sellerId]) {
      this.deps.notifier.send(id, "offer:updated", { offer: result.offer });
      this.deps.notifier.send(id, "message:new", { message: chatMessage });
      this.deps.notifier.send(id, "order:updated", { order: result.order });
    }
    announceExpired(this.deps.notifier, accepted.lapsed, now);
    void this.notify(offer.authorId, userId, conversation.id, chatMessage.body);
    return result;
  }

  /** The other person says no; the conversation goes on. */
  async decline(userId: string, offerId: string): Promise<Offer> {
    const offer = await this.answerable(userId, offerId);
    const now = this.now();
    const { count } = await this.prisma.offer.updateMany({
      where: { id: offerId, status: "pending", expiresAt: { gt: now } },
      data: { status: "declined", respondedAt: now },
    });
    if (count === 0) throw offerClosed();

    const declined = toOffer(
      { ...offer, status: "declined", respondedAt: now },
      now,
    );
    for (const id of [
      offer.conversation.buyerId,
      offer.conversation.sellerId,
    ]) {
      this.deps.notifier.send(id, "offer:updated", { offer: declined });
    }
    void this.notify(
      offer.authorId,
      userId,
      offer.conversationId,
      declinedSummary(offer),
    );
    return declined;
  }

  /** An offer the user can accept or decline: someone else's, still pending. */
  private async answerable(userId: string, offerId: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: offerId, conversation: participantOf(userId) },
      include: {
        conversation: {
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            productId: true,
            product: { select: { status: true } },
          },
        },
      },
    });
    if (!offer) throw offerNotFound();
    if (offer.authorId === userId) {
      throw new AppError(403, "forbidden", "This is your own offer.");
    }
    if (offerStatusAt(offer, this.now()) !== "pending") throw offerClosed();
    return offer;
  }

  private async notify(
    recipientId: string,
    senderId: string,
    conversationId: string,
    body: string,
  ): Promise<void> {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { fullName: true },
      });
      const data: MessagePushData = { type: "message", conversationId };
      await this.deps.push.sendToUser(recipientId, {
        title: sender?.fullName ?? "Dily",
        body,
        data,
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, recipientId },
        "offers: notification failed",
      );
    }
  }
}
