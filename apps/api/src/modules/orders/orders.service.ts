import {
  DIRECT_BUY_HOLD_MINUTES,
  listedTotal,
  PAYMENT_TTL_SECONDS,
  type directBuyBodySchema,
  type MessagePushData,
  type Order,
  type OrderDetails,
  type Payment,
  type paymentBodySchema,
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
import {
  offerStatusAt,
  orderStatusAt,
  paymentStatusAt,
  toOffer,
  toOrder,
  toPayment,
} from "../offers/offer-rows.js";
import {
  announceExpired,
  buyerTerms,
  expireLapsedOrders,
  openOrdersOf,
  reservedElsewhere,
  unavailable,
} from "../offers/terms.js";
import type { UserNotifier } from "../realtime/notifier.js";
import type { PaymentGateway, PaymentOutcome } from "./payment-gateway.js";

export type DirectBuyInput = z.output<typeof directBuyBodySchema>;
export type PaymentInput = z.output<typeof paymentBodySchema>;

/** Direct buys per user: far above a real buyer's pace. */
export const DIRECT_BUY_RATE_LIMIT: RateLimitRule = {
  max: 20,
  windowSeconds: 3600,
};
/** Payment attempts per user, retries after a refusal included. */
export const PAYMENT_RATE_LIMIT: RateLimitRule = {
  max: 20,
  windowSeconds: 3600,
};

const MINUTE_MS = 60 * 1000;

// In French like the screens: the chat and notifications show them
const paidSummary = ({ amount, fulfilment }: OrderRow) =>
  `Payé : ${formatPrice(amount)} F${fulfilment === "delivery" ? ", livraison comprise" : ""}`;

const conflict = (message: string) => new AppError(409, "conflict", message);
const orderNotFound = () => notFound("This order doesn't exist.");
const paymentWaiting = () =>
  conflict("A payment is already waiting for your confirmation.");

export interface OrdersServiceDeps {
  prisma: PrismaClient;
  notifier: UserNotifier;
  push: PushService;
  rateLimiter: RateLimiter;
  gateway: PaymentGateway;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

/**
 * Buying: orders (an accepted offer, or a direct buy at the listed price)
 * and their mobile money payments. The operator asks the payer to confirm
 * on their phone and answers later (`settle`); once paid, the listing is
 * sold and Dily holds the money until the buyer has the item.
 */
export class OrdersService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: OrdersServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
    deps.gateway.onOutcome((paymentId, outcome) =>
      this.settle(paymentId, outcome),
    );
  }

  /**
   * "Acheter": an order at the listed price, delivery included, held for
   * the buyer while they pay. It ends the negotiation: a pending offer in
   * the conversation is replaced. Buying again replaces one's own unpaid
   * direct buy: the buyer went back to change how they get the item.
   */
  async buy(userId: string, input: DirectBuyInput): Promise<Order> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: input.conversationId, ...participantOf(userId) },
      select: {
        id: true,
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
    if (conversation.buyerId !== userId) {
      throw new AppError(403, "forbidden", "This is your own listing.");
    }
    await this.deps.rateLimiter.consume(
      `order:user:${userId}`,
      DIRECT_BUY_RATE_LIMIT,
    );

    const now = this.now();
    const { product, productId } = conversation;
    if (product.status !== "active") throw unavailable();
    const terms = buyerTerms(input, product, conversation);
    const open = await openOrdersOf(this.prisma, productId, now);
    if (open.some((o) => o.conversationId !== conversation.id)) {
      throw reservedElsewhere();
    }
    const previous = open[0];
    if (previous && (previous.offerId !== null || previous.status === "paid")) {
      throw conflict("You already have an order for this item.");
    }

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const lapsed = await expireLapsedOrders(tx, productId, now);
        let dropped: OrderRow | null = null;
        if (previous) {
          const running = await tx.payment.findFirst({
            where: { orderId: previous.id, status: "pending" },
          });
          if (running && paymentStatusAt(running, now) === "pending") {
            throw paymentWaiting();
          }
          const { count } = await tx.order.updateMany({
            where: { id: previous.id, status: "awaiting_payment" },
            data: { status: "cancelled" },
          });
          if (count === 0) {
            throw conflict("You already have an order for this item.");
          }
          dropped = { ...previous, status: "cancelled" };
        }
        let replaced: OfferRow | null = null;
        const pending = await tx.offer.findFirst({
          where: { conversationId: conversation.id, status: "pending" },
        });
        if (pending) {
          const status =
            offerStatusAt(pending, now) === "expired"
              ? "expired"
              : "superseded";
          const { count } = await tx.offer.updateMany({
            where: { id: pending.id, status: "pending" },
            data: { status },
          });
          if (count > 0) replaced = { ...pending, status };
        }
        const order = await tx.order.create({
          data: {
            conversationId: conversation.id,
            productId,
            buyerId: conversation.buyerId,
            sellerId: conversation.sellerId,
            amount: listedTotal({ listPrice: product.price, ...terms }),
            listPrice: product.price,
            ...terms,
            reservedUntil: new Date(
              now.getTime() + DIRECT_BUY_HOLD_MINUTES * MINUTE_MS,
            ),
            createdAt: now,
          },
        });
        return { order, replaced, dropped, lapsed };
      });
    } catch (error) {
      // Another buyer's order got there first
      if (isUniqueViolation(error)) throw reservedElsewhere();
      throw error;
    }

    const order = toOrder(created.order, now);
    for (const id of [conversation.buyerId, conversation.sellerId]) {
      if (created.dropped) {
        this.deps.notifier.send(id, "order:updated", {
          order: toOrder(created.dropped, now),
        });
      }
      this.deps.notifier.send(id, "order:updated", { order });
      if (created.replaced) {
        this.deps.notifier.send(id, "offer:updated", {
          offer: toOffer(created.replaced, now),
        });
      }
    }
    announceExpired(this.deps.notifier, created.lapsed, now);
    return order;
  }

  /** The order; the buyer also gets their latest payment attempt. */
  async get(userId: string, orderId: string): Promise<OrderDetails> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
      },
    });
    if (!row) throw orderNotFound();
    const now = this.now();
    const payment = row.buyerId === userId ? row.payments[0] : undefined;
    return {
      order: toOrder(row, now),
      payment: payment ? toPayment(payment, now) : null,
    };
  }

  /**
   * "Payer": saves where to deliver, then asks the operator to show the
   * payment on the payer's phone. One attempt at a time; while it runs the
   * order can't lapse. Sending the same id again returns the saved attempt.
   */
  async pay(
    userId: string,
    orderId: string,
    input: PaymentInput,
  ): Promise<Payment> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId: userId },
      include: { buyer: { select: { phoneE164: true } } },
    });
    if (!order) throw orderNotFound();

    const saved = await this.prisma.payment.findUnique({
      where: { id: input.id },
    });
    if (saved) {
      if (saved.orderId === orderId) return toPayment(saved, this.now());
      throw new AppError(400, "validation_error", "Invalid payment id.");
    }
    await this.deps.rateLimiter.consume(
      `payment:user:${userId}`,
      PAYMENT_RATE_LIMIT,
    );

    const now = this.now();
    const status = orderStatusAt(order, now);
    if (status === "paid") throw conflict("This order is already paid.");
    if (status !== "awaiting_payment") {
      throw conflict("This order can no longer be paid.");
    }
    const delivery = order.fulfilment === "delivery";
    const expiresAt = new Date(now.getTime() + PAYMENT_TTL_SECONDS * 1000);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // An attempt never confirmed gives way; one still running doesn't
        const pending = await tx.payment.findFirst({
          where: { orderId, status: "pending" },
        });
        if (pending) {
          if (paymentStatusAt(pending, now) === "pending") {
            throw paymentWaiting();
          }
          await tx.payment.update({
            where: { id: pending.id },
            data: { status: "expired" },
          });
        }
        const { count } = await tx.order.updateMany({
          where: {
            id: orderId,
            status: "awaiting_payment",
            reservedUntil: { gt: now },
          },
          data: {
            landmark: delivery ? input.landmark : null,
            contactPhone: delivery
              ? (input.contactPhone ?? order.buyer.phoneE164)
              : null,
            // Never lapses while the payer is confirming
            reservedUntil:
              order.reservedUntil < expiresAt ? expiresAt : order.reservedUntil,
          },
        });
        if (count === 0) throw conflict("This order can no longer be paid.");
        return tx.payment.create({
          data: {
            id: input.id,
            orderId,
            provider: input.provider,
            payerPhone: input.payerPhone,
            amount: order.amount,
            expiresAt,
            createdAt: now,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw paymentWaiting();
      throw error;
    }

    try {
      await this.deps.gateway.request({
        paymentId: created.id,
        provider: created.provider,
        payerPhone: created.payerPhone,
        amount: created.amount,
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, paymentId: created.id },
        "payments: operator unreachable",
      );
      await this.settle(created.id, {
        status: "failed",
        reason: "unavailable",
      });
      const failed = await this.prisma.payment.findUniqueOrThrow({
        where: { id: created.id },
      });
      return toPayment(failed, this.now());
    }
    return toPayment(created, now);
  }

  /**
   * "Je n'ai rien reçu": the buyer stops waiting, and can try again. An
   * attempt already over is returned as it is.
   */
  async cancelPayment(
    userId: string,
    orderId: string,
    paymentId: string,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, orderId, order: { buyerId: userId } },
    });
    if (!payment) throw notFound("This payment doesn't exist.");
    const now = this.now();
    const status = paymentStatusAt(payment, now);
    if (status === "succeeded") throw conflict("This payment went through.");
    if (status !== "pending") return toPayment(payment, now);

    // A late answer from the operator finds it closed (settle)
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: "pending" },
      data: { status: "cancelled", settledAt: now },
    });
    const current = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    const result = toPayment(current, now);
    if (count > 0) {
      this.deps.notifier.send(userId, "payment:updated", { payment: result });
    }
    return result;
  }

  /**
   * The operator's answer. Paid: the order is paid, the listing sold, and
   * a direct buy shows in the chat. Refused: the buyer can try again. An
   * answer for an attempt already closed changes nothing.
   */
  async settle(paymentId: string, outcome: PaymentOutcome): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) {
      this.deps.logger.warn({ paymentId }, "payments: unknown payment");
      return;
    }
    const { order } = payment;
    const now = this.now();

    if (outcome.status === "failed") {
      const { count } = await this.prisma.payment.updateMany({
        where: { id: paymentId, status: "pending" },
        data: {
          status: "failed",
          failureReason: outcome.reason,
          settledAt: now,
        },
      });
      if (count > 0) {
        const failed = toPayment(
          {
            ...payment,
            status: "failed",
            failureReason: outcome.reason,
            settledAt: now,
          },
          now,
        );
        this.deps.notifier.send(order.buyerId, "payment:updated", {
          payment: failed,
        });
      }
      return;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: "pending" },
        data: {
          status: "succeeded",
          reference: outcome.reference,
          settledAt: now,
        },
      });
      if (count === 0) return null;
      const paid = await tx.order.updateMany({
        where: { id: order.id, status: "awaiting_payment" },
        data: { status: "paid", paidAt: now },
      });
      if (paid.count === 0) return { orderPaid: false, message: null };
      await tx.product.update({
        where: { id: order.productId },
        data: { status: "sold" },
      });
      // An accepted offer is already in the chat; a direct buy shows now
      const message =
        order.offerId === null
          ? await tx.message.create({
              data: {
                conversationId: order.conversationId,
                senderId: order.buyerId,
                kind: "deal",
                body: paidSummary(order),
                orderId: order.id,
                createdAt: now,
              },
              include: MESSAGE_INCLUDE,
            })
          : null;
      return { orderPaid: true, message };
    });

    if (!result) {
      // Confirmed after the buyer gave up, or a duplicate answer
      this.deps.logger.error(
        { paymentId, status: payment.status },
        "payments: operator confirmed a closed payment, refund needed",
      );
      return;
    }
    const succeeded = toPayment(
      {
        ...payment,
        status: "succeeded",
        reference: outcome.reference,
        settledAt: now,
      },
      now,
    );
    this.deps.notifier.send(order.buyerId, "payment:updated", {
      payment: succeeded,
    });
    if (!result.orderPaid) {
      // The hold ended and another buyer got the item meanwhile
      this.deps.logger.error(
        { paymentId, orderId: order.id },
        "payments: paid an order no longer awaiting payment, refund needed",
      );
      return;
    }

    const paidOrder = toOrder({ ...order, status: "paid", paidAt: now }, now);
    const participants = [order.buyerId, order.sellerId];
    for (const id of participants) {
      this.deps.notifier.send(id, "order:updated", { order: paidOrder });
      if (result.message) {
        this.deps.notifier.send(id, "message:new", {
          message: toChatMessage(result.message, now),
        });
      }
    }
    void this.notifyPaid(order);
  }

  /** The seller can get the item ready; the buyer, back from the operator's screen, knows it went through. */
  private async notifyPaid(order: OrderRow): Promise<void> {
    const data: MessagePushData = {
      type: "message",
      conversationId: order.conversationId,
    };
    const amount = `${formatPrice(order.amount)} F`;
    try {
      const buyer = await this.prisma.user.findUnique({
        where: { id: order.buyerId },
        select: { fullName: true },
      });
      await Promise.all([
        this.deps.push.sendToUser(order.sellerId, {
          title: buyer?.fullName ?? "Dily",
          body: `Paiement reçu : ${amount}. Dily le garde jusqu'à la remise.`,
          data,
        }),
        this.deps.push.sendToUser(order.buyerId, {
          title: "Dily",
          body: `Paiement confirmé : ${amount}`,
          data,
        }),
      ]);
    } catch (error) {
      this.deps.logger.error(
        { err: error, orderId: order.id },
        "payments: notification failed",
      );
    }
  }
}
