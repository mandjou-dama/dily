import { randomInt } from "node:crypto";
import {
  HANDOVER_CODE_LENGTH,
  HANDOVER_DAYS,
  HANDOVER_REMINDER_DAYS,
  type DisputeReason,
  type disputeBodySchema,
  type MessagePushData,
  type PaymentProvider,
} from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";
import type {
  Order as OrderRow,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { AppError, notFound } from "../../lib/errors.js";
import { formatPrice } from "../../lib/format.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import {
  MESSAGE_INCLUDE,
  type MessageRow,
  toChatMessage,
} from "../chat/chat.service.js";
import type { MediaService } from "../media/media.service.js";
import type { PushService } from "../notifications/push.service.js";
import { toOrder, toTransfer } from "../offers/offer-rows.js";
import type { UserNotifier } from "../realtime/notifier.js";
import type { PaymentGateway, TransferOutcome } from "./payment-gateway.js";

export type DisputeInput = z.output<typeof disputeBodySchema>;

/** Wrong codes per order: 5 tries, then a 15 min wait. */
export const HANDOVER_CODE_RATE_LIMIT: RateLimitRule = {
  max: 5,
  windowSeconds: 15 * 60,
};
/** Sending money again after a failure: up to 5 tries, 15 min apart then more. */
export const TRANSFER_MAX_ATTEMPTS = 5;
const TRANSFER_RETRY_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Orders or transfers handled per run of the due job. */
const BATCH = 100;

/** "0427": what the buyer gives the seller once they have the item. */
export const newHandoverCode = () =>
  String(randomInt(0, 10 ** HANDOVER_CODE_LENGTH)).padStart(
    HANDOVER_CODE_LENGTH,
    "0",
  );

// In French like the screens: the chat and notifications show them
const REASON_LABELS: Record<DisputeReason, string> = {
  not_received: "pas reçu",
  not_as_described: "pas conforme à l'annonce",
  other: "autre problème",
};
const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
};
const amountLabel = (amount: number) => `${formatPrice(amount)} F`;
const firstName = (name: string | null) => name?.split(" ")[0] ?? "L'acheteur";
/** "lundi 2 novembre", in Bamako's time. */
const dayLabel = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Bamako",
  });

const conflict = (message: string) => new AppError(409, "conflict", message);
const orderNotFound = () => notFound("This order doesn't exist.");
const notHandedOverYet = () =>
  conflict("This order isn't waiting for its handover.");

/** Paid orders whose item hasn't changed hands yet. */
const AWAITING_HANDOVER = ["paid", "disputed"] as const;

type RefundCause = "no_handover" | "seller" | "dily";

export interface HandoverServiceDeps {
  prisma: PrismaClient;
  notifier: UserNotifier;
  push: PushService;
  rateLimiter: RateLimiter;
  media: MediaService;
  gateway: PaymentGateway;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

/**
 * After the payment: Dily keeps the money until the item changes hands.
 * The buyer gives a 4-digit code once they have it and checked it; the
 * seller types it (or the buyer confirms) and the money goes to the
 * seller. The buyer can report a problem instead, which keeps the money
 * until the seller refunds or Dily decides. Not handed over within
 * HANDOVER_DAYS, the buyer is refunded and the listing is back on sale.
 */
export class HandoverService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: HandoverServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
    deps.gateway.onTransferOutcome((transferId, outcome) =>
      this.settleTransfer(transferId, outcome),
    );
  }

  /** The seller types the code the buyer gave: the item changed hands. */
  async handover(sellerId: string, orderId: string, code: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId },
    });
    if (!order) throw orderNotFound();
    if (!isAwaitingHandover(order)) throw notHandedOverYet();
    // Right codes count too: 10 000 codes can't be tried one by one
    await this.deps.rateLimiter.consume(
      `handover:order:${orderId}`,
      HANDOVER_CODE_RATE_LIMIT,
    );
    if (order.handoverCode !== code) {
      throw new AppError(
        400,
        "handover_code_invalid",
        "This isn't the buyer's code.",
      );
    }
    await this.complete(order, sellerId);
  }

  /** The buyer says they have the item, without the seller typing the code. */
  async confirm(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
    });
    if (!order) throw orderNotFound();
    if (!isAwaitingHandover(order)) throw notHandedOverYet();
    await this.complete(order, buyerId);
  }

  /** The buyer reports a problem: the money stays with Dily. */
  async dispute(buyerId: string, orderId: string, input: DisputeInput) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
    });
    if (!order) throw orderNotFound();
    if (order.status === "disputed") {
      throw conflict("A problem is already reported for this order.");
    }
    if (order.status !== "paid") throw notHandedOverYet();
    const photos = input.photoPaths.filter((path) =>
      this.deps.media.isOwnReportImage(buyerId, path),
    );
    if (photos.length !== input.photoPaths.length) {
      throw new AppError(400, "validation_error", "Invalid photo.");
    }

    const now = this.now();
    const message = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: "paid" },
        data: { status: "disputed" },
      });
      if (count === 0) throw notHandedOverYet();
      await tx.dispute.create({
        data: {
          orderId: order.id,
          reason: input.reason,
          note: input.note,
          photoPaths: photos,
          createdAt: now,
        },
      });
      return tx.message.create({
        data: {
          conversationId: order.conversationId,
          senderId: buyerId,
          kind: "dispute",
          body: `Problème signalé : ${REASON_LABELS[input.reason]}`,
          orderId: order.id,
          createdAt: now,
        },
        include: MESSAGE_INCLUDE,
      });
    });

    this.announce(order, message, now);
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId },
      select: { fullName: true },
    });
    void this.notify(order.sellerId, order, {
      title: buyer?.fullName ?? "Dily",
      body: `Problème signalé : ${REASON_LABELS[input.reason]}. Dily garde l'argent en attendant.`,
    });
  }

  /** The seller gives the money back, before the handover or after a report. */
  async refundBySeller(sellerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId },
    });
    if (!order) throw orderNotFound();
    if (!isAwaitingHandover(order)) throw notHandedOverYet();
    await this.refund(order, "seller");
  }

  /** Dily's decision on a reported problem (support, through a script). */
  async resolveDispute(orderId: string, decision: "refund" | "release") {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw orderNotFound();
    if (order.status !== "disputed") {
      throw conflict("No problem is reported for this order.");
    }
    if (decision === "refund") await this.refund(order, "dily");
    else await this.complete(order, order.sellerId);
  }

  /**
   * Where the user receives money changed: their payouts waiting for an
   * account, or that failed, leave again.
   */
  async payoutAccountChanged(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { payoutProvider: true, payoutPhone: true },
    });
    if (!user?.payoutProvider || !user.payoutPhone) return;
    const now = this.now();
    const waiting = await this.prisma.transfer.findMany({
      where: {
        recipientId: userId,
        kind: "payout",
        status: { in: ["awaiting_account", "failed"] },
      },
    });
    for (const transfer of waiting) {
      const { count } = await this.prisma.transfer.updateMany({
        where: { id: transfer.id, status: transfer.status },
        data: {
          provider: user.payoutProvider,
          phone: user.payoutPhone,
          status: "pending",
          failureReason: null,
          // A new account: a fresh round of tries
          attempts: 0,
          nextAttemptAt: now,
        },
      });
      if (count === 0) continue;
      // The seller's screen leaves "Ajoute ton numéro" at once
      const pending = await this.prisma.transfer.findUniqueOrThrow({
        where: { id: transfer.id },
      });
      this.deps.notifier.send(userId, "transfer:updated", {
        transfer: toTransfer(pending),
      });
      await this.sendTransfer(transfer.id);
    }
  }

  /**
   * Deadlines (BullMQ, every minute): reminders to hand the item over,
   * refunds past HANDOVER_DAYS, transfers to try again. The database is the
   * truth: a run that's missed or repeated changes nothing.
   */
  async runDue(): Promise<{
    reminded: number;
    refunded: number;
    sent: number;
  }> {
    const now = this.now();
    let reminded = 0;
    for (const [index, days] of HANDOVER_REMINDER_DAYS.entries()) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: "paid",
          handoverReminders: index,
          paidAt: { lte: new Date(now.getTime() - days * DAY_MS) },
        },
        include: {
          product: { select: { title: true } },
          buyer: { select: { fullName: true } },
        },
        take: BATCH,
      });
      for (const order of orders) {
        const { count } = await this.prisma.order.updateMany({
          where: { id: order.id, status: "paid", handoverReminders: index },
          data: { handoverReminders: index + 1 },
        });
        if (count === 0) continue;
        reminded += 1;
        void this.remind(order, order.product.title, order.buyer.fullName);
      }
    }

    const lapsed = await this.prisma.order.findMany({
      where: {
        status: "paid",
        paidAt: { lte: new Date(now.getTime() - HANDOVER_DAYS * DAY_MS) },
      },
      take: BATCH,
    });
    let refunded = 0;
    for (const order of lapsed) {
      try {
        await this.refund(order, "no_handover");
        refunded += 1;
      } catch (error) {
        // Handed over or refunded meanwhile; anything else waits for the next run
        if (!(error instanceof AppError)) {
          this.deps.logger.error(
            { err: error, orderId: order.id },
            "handover: refund failed",
          );
        }
      }
    }

    const due = await this.prisma.transfer.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        nextAttemptAt: { lte: now },
        attempts: { lt: TRANSFER_MAX_ATTEMPTS },
      },
      select: { id: true },
      take: BATCH,
    });
    for (const transfer of due) await this.sendTransfer(transfer.id);

    return { reminded, refunded, sent: due.length };
  }

  /**
   * The item changed hands: the order is completed and the money leaves for
   * the seller's payout account (or waits for one).
   */
  private async complete(order: OrderRow, senderId: string) {
    const now = this.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...AWAITING_HANDOVER] } },
        data: { status: "completed", completedAt: now, handoverCode: null },
      });
      if (count === 0) throw notHandedOverYet();
      await tx.dispute.updateMany({
        where: { orderId: order.id, status: "open" },
        data: { status: "released", resolvedAt: now },
      });
      const seller = await tx.user.findUniqueOrThrow({
        where: { id: order.sellerId },
        select: { payoutProvider: true, payoutPhone: true },
      });
      const account =
        seller.payoutProvider && seller.payoutPhone
          ? { provider: seller.payoutProvider, phone: seller.payoutPhone }
          : null;
      const transfer = await tx.transfer.create({
        data: {
          orderId: order.id,
          kind: "payout",
          recipientId: order.sellerId,
          amount: order.amount,
          provider: account?.provider ?? null,
          phone: account?.phone ?? null,
          status: account ? "pending" : "awaiting_account",
          nextAttemptAt: account ? now : null,
          createdAt: now,
        },
      });
      const message = await tx.message.create({
        data: {
          conversationId: order.conversationId,
          senderId,
          kind: "handover",
          body: `Remis : ${amountLabel(order.amount)} pour le vendeur`,
          orderId: order.id,
          createdAt: now,
        },
        include: MESSAGE_INCLUDE,
      });
      return { transfer, message, account };
    });

    this.announce(order, result.message, now);
    this.deps.notifier.send(order.sellerId, "transfer:updated", {
      transfer: toTransfer(result.transfer),
    });
    const amount = amountLabel(order.amount);
    void this.notify(order.sellerId, order, {
      title: "Dily",
      body: result.account
        ? `Remise confirmée : ${amount} partent sur ton ${PROVIDER_LABELS[result.account.provider]}.`
        : `Remise confirmée. Ajoute ton numéro Orange Money ou Moov Money pour recevoir ${amount}.`,
    });
    if (senderId !== order.buyerId) {
      void this.notify(order.buyerId, order, {
        title: "Dily",
        body: "Remise confirmée. Merci d'avoir acheté sur Dily !",
      });
    }
    if (result.account) await this.sendTransfer(result.transfer.id);
  }

  /**
   * The money goes back to the number that paid; the listing is on sale
   * again (the item never left the seller).
   */
  private async refund(order: OrderRow, cause: RefundCause) {
    const now = this.now();
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...AWAITING_HANDOVER] } },
        data: { status: "refunded", refundedAt: now, handoverCode: null },
      });
      if (count === 0) throw notHandedOverYet();
      await tx.dispute.updateMany({
        where: { orderId: order.id, status: "open" },
        data: { status: "refunded", resolvedAt: now },
      });
      await tx.product.updateMany({
        where: { id: order.productId, status: "sold" },
        data: { status: "active" },
      });
      const payment = await tx.payment.findFirstOrThrow({
        where: { orderId: order.id, status: "succeeded" },
      });
      const transfer = await tx.transfer.create({
        data: {
          orderId: order.id,
          kind: "refund",
          recipientId: order.buyerId,
          amount: order.amount,
          provider: payment.provider,
          phone: payment.payerPhone,
          status: "pending",
          nextAttemptAt: now,
          createdAt: now,
        },
      });
      const message = await tx.message.create({
        data: {
          conversationId: order.conversationId,
          senderId: order.sellerId,
          kind: "refund",
          body: `Remboursé : ${amountLabel(order.amount)}`,
          orderId: order.id,
          createdAt: now,
        },
        include: MESSAGE_INCLUDE,
      });
      return { transfer, message, provider: payment.provider };
    });

    this.announce(order, result.message, now);
    this.deps.notifier.send(order.buyerId, "transfer:updated", {
      transfer: toTransfer(result.transfer),
    });
    const amount = amountLabel(order.amount);
    void this.notify(order.buyerId, order, {
      title: "Dily",
      body:
        cause === "no_handover"
          ? `L'article n'a pas été remis à temps : ${amount} reviennent sur ton ${PROVIDER_LABELS[result.provider]}.`
          : `Remboursement : ${amount} reviennent sur ton ${PROVIDER_LABELS[result.provider]}.`,
    });
    if (cause !== "seller") {
      const buyer = await this.prisma.user.findUnique({
        where: { id: order.buyerId },
        select: { fullName: true },
      });
      const name = firstName(buyer?.fullName ?? null);
      void this.notify(order.sellerId, order, {
        title: "Dily",
        body:
          cause === "no_handover"
            ? `L'article n'a pas été remis à temps : ${name} récupère son argent. Ton annonce est de nouveau en vente.`
            : `Dily a remboursé ${name}. Ton annonce est de nouveau en vente.`,
      });
    }
    await this.sendTransfer(result.transfer.id);
  }

  /**
   * Asks the operator to send a transfer that's due. Its next try is set
   * first: an operator that never answers gets asked again (same id, no
   * double payment).
   */
  private async sendTransfer(transferId: string) {
    const now = this.now();
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer?.provider || !transfer.phone) return;
    const { count } = await this.prisma.transfer.updateMany({
      where: {
        id: transferId,
        status: { in: ["pending", "failed"] },
        attempts: { lt: TRANSFER_MAX_ATTEMPTS },
      },
      data: {
        status: "pending",
        failureReason: null,
        attempts: { increment: 1 },
        nextAttemptAt: new Date(
          now.getTime() + TRANSFER_RETRY_MS * (transfer.attempts + 1),
        ),
      },
    });
    if (count === 0) return;
    try {
      await this.deps.gateway.send({
        transferId,
        provider: transfer.provider,
        phone: transfer.phone,
        amount: transfer.amount,
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, transferId },
        "transfers: operator unreachable",
      );
      await this.settleTransfer(transferId, {
        status: "failed",
        reason: "unavailable",
      });
    }
  }

  /** The operator's answer for a transfer. One for a settled transfer changes nothing. */
  async settleTransfer(transferId: string, outcome: TransferOutcome) {
    const now = this.now();
    const data: Prisma.TransferUpdateManyMutationInput =
      outcome.status === "succeeded"
        ? {
            status: "succeeded",
            reference: outcome.reference,
            settledAt: now,
            nextAttemptAt: null,
          }
        : { status: "failed", failureReason: outcome.reason };
    const { count } = await this.prisma.transfer.updateMany({
      where: { id: transferId, status: "pending" },
      data,
    });
    if (count === 0) return;
    const transfer = await this.prisma.transfer.findUniqueOrThrow({
      where: { id: transferId },
      include: { order: true },
    });
    this.deps.notifier.send(transfer.recipientId, "transfer:updated", {
      transfer: toTransfer(transfer),
    });
    if (outcome.status === "succeeded") return;

    this.deps.logger.warn(
      { transferId, reason: outcome.reason, attempts: transfer.attempts },
      "transfers: failed",
    );
    // A seller can fix their number; a refund is support's to look at
    if (transfer.kind === "payout" && transfer.attempts === 1) {
      void this.notify(transfer.recipientId, transfer.order, {
        title: "Dily",
        body: `Le versement de ${amountLabel(transfer.amount)} n'est pas passé. Vérifie ton numéro de paiement dans ton profil.`,
      });
    }
  }

  /** Both sides see the new status and the message in the chat. */
  private announce(order: OrderRow, message: MessageRow, now: Date) {
    // Written in the same transaction: the order as it is now
    const fresh = toOrder(message.order ?? order, now);
    const chatMessage = toChatMessage(message, now);
    for (const id of [order.buyerId, order.sellerId]) {
      this.deps.notifier.send(id, "order:updated", { order: fresh });
      this.deps.notifier.send(id, "message:new", { message: chatMessage });
    }
  }

  /** Reminders to the seller to hand over, and to the buyer to keep the code. */
  private async remind(
    order: OrderRow,
    title: string,
    buyerName: string | null,
  ) {
    const paidAt = order.paidAt ?? order.createdAt;
    const deadline = dayLabel(
      new Date(paidAt.getTime() + HANDOVER_DAYS * DAY_MS),
    );
    const name = firstName(buyerName);
    await Promise.all([
      this.notify(order.sellerId, order, {
        title: "Dily",
        body: `Remets « ${title} » à ${name} et saisis son code de remise pour être payé. Sans remise d'ici ${deadline}, ${name} récupère son argent.`,
      }),
      this.notify(order.buyerId, order, {
        title: "Dily",
        body: `Garde ton code de remise pour « ${title} ». Rien reçu d'ici ${deadline} : ton argent te revient automatiquement.`,
      }),
    ]);
  }

  private async notify(
    userId: string,
    order: Pick<OrderRow, "id" | "conversationId">,
    message: { title: string; body: string },
  ) {
    const data: MessagePushData = {
      type: "message",
      conversationId: order.conversationId,
    };
    try {
      await this.deps.push.sendToUser(userId, { ...message, data });
    } catch (error) {
      this.deps.logger.error(
        { err: error, orderId: order.id },
        "handover: notification failed",
      );
    }
  }
}

const isAwaitingHandover = (order: Pick<OrderRow, "status">) =>
  (AWAITING_HANDOVER as readonly string[]).includes(order.status);
