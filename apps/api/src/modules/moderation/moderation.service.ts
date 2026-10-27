import type { BlockedUsers, ReportInput } from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";
import type {
  Order as OrderRow,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import {
  conversationNotFound,
  isUniqueViolation,
  participantOf,
} from "../chat/chat.service.js";
import { toOrder } from "../offers/offer-rows.js";
import type { UserNotifier } from "../realtime/notifier.js";
import type { ReportAlerter } from "./report-alerter.js";
import { listingVisibleTo } from "./visibility.js";

/** Reports per user, far above what an honest user sends: bounds abuse of the queue. */
export const REPORT_RATE_LIMIT: RateLimitRule = {
  max: 10,
  windowSeconds: 3600,
};

/** Dily's answer to a report. */
export type ReportDecision =
  /** Nothing against the rules */
  | "dismiss"
  /** The listing leaves Dily: only its seller still sees it */
  | "remove"
  /** The account is closed: signed out, can't sign in, its listings hidden */
  | "suspend";

const conflict = (message: string) => new AppError(409, "conflict", message);

const OPEN_REPORT_INCLUDE = {
  reporter: { select: { fullName: true, phoneE164: true } },
  reportedUser: {
    select: {
      fullName: true,
      phoneE164: true,
      suspendedAt: true,
      _count: { select: { reportsReceived: { where: { status: "open" } } } },
    },
  },
  product: { select: { title: true, status: true } },
} satisfies Prisma.ReportInclude;

export type OpenReport = Prisma.ReportGetPayload<{
  include: typeof OPEN_REPORT_INCLUDE;
}>;

export interface ModerationServiceDeps {
  prisma: PrismaClient;
  notifier: UserNotifier;
  rateLimiter: RateLimiter;
  /** Tells Dily a report came in (Discord, or the logs). */
  alerter: ReportAlerter;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

/**
 * Reports and blocks (App Store guideline 1.2). People report a listing or
 * the other person of a conversation, and block whoever they want; Dily
 * reviews reports through a script until an admin screen exists.
 */
export class ModerationService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: ModerationServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
  }

  /** Reporting the same listing or person again while it's open changes nothing. */
  async report(userId: string, input: ReportInput): Promise<void> {
    await this.deps.rateLimiter.consume(
      `report:user:${userId}`,
      REPORT_RATE_LIMIT,
    );

    let target: Pick<
      Prisma.ReportUncheckedCreateInput,
      "kind" | "reportedUserId" | "productId" | "conversationId"
    >;
    if (input.kind === "listing") {
      const product = await this.prisma.product.findFirst({
        where: { id: input.productId, ...listingVisibleTo(userId) },
        select: { sellerId: true },
      });
      if (!product) throw notFound("This listing isn't available.");
      if (product.sellerId === userId) {
        throw new AppError(403, "forbidden", "This is your own listing.");
      }
      target = {
        kind: "listing",
        reportedUserId: product.sellerId,
        productId: input.productId,
      };
    } else {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: input.conversationId, ...participantOf(userId) },
        select: { buyerId: true, sellerId: true },
      });
      if (!conversation) throw conversationNotFound();
      target = {
        kind: "user",
        reportedUserId:
          conversation.buyerId === userId
            ? conversation.sellerId
            : conversation.buyerId,
        conversationId: input.conversationId,
      };
    }

    let reportId: string;
    try {
      const report = await this.prisma.report.create({
        data: {
          ...target,
          reporterId: userId,
          reason: input.reason,
          note: input.note,
          createdAt: this.now(),
        },
        select: { id: true },
      });
      reportId = report.id;
    } catch (error) {
      // Already reported, and still open: Dily already knows
      if (isUniqueViolation(error)) return;
      throw error;
    }
    // The reporter doesn't wait for Discord
    void this.alertNewReport(reportId);
  }

  private async alertNewReport(reportId: string): Promise<void> {
    try {
      const report = await this.prisma.report.findUniqueOrThrow({
        where: { id: reportId },
        include: {
          reporter: { select: { fullName: true } },
          reportedUser: {
            select: {
              fullName: true,
              _count: {
                select: { reportsReceived: { where: { status: "open" } } },
              },
            },
          },
          product: { select: { title: true } },
        },
      });
      await this.deps.alerter.alert({
        reportId,
        kind: report.kind,
        reason: report.reason,
        note: report.note,
        reportedName: report.reportedUser.fullName ?? "?",
        openReports: report.reportedUser._count.reportsReceived,
        reporterName: report.reporter?.fullName ?? "?",
        listingTitle: report.product?.title ?? null,
        conversationId: report.conversationId,
      });
    } catch (error) {
      this.deps.logger.error(
        { err: error, reportId },
        "moderation: alert failed",
      );
    }
  }

  /**
   * Idempotent. Agreements between the two not paid yet end, so the
   * listing is free for other buyers; a paid order goes to its end.
   */
  async block(userId: string, blockedId: string): Promise<void> {
    if (blockedId === userId) {
      throw new AppError(400, "validation_error", "You can't block yourself.");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!user) throw notFound("This person doesn't exist.");

    const now = this.now();
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.block.createMany({
        data: [{ blockerId: userId, blockedId, createdAt: now }],
        skipDuplicates: true,
      });
      if (count === 0) return [];
      return cancelUnpaidOrders(
        tx,
        {
          OR: [
            { buyerId: userId, sellerId: blockedId },
            { buyerId: blockedId, sellerId: userId },
          ],
        },
        now,
      );
    });
    this.announce(cancelled, now);
  }

  async unblock(userId: string, blockedId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { blockerId: userId, blockedId },
    });
  }

  /** The people the user blocked, the latest first. */
  async blockedUsers(userId: string): Promise<BlockedUsers> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        blocked: { select: { id: true, fullName: true, avatarPath: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.blocked.id,
        name: row.blocked.fullName ?? "Dily",
        avatarPath: row.blocked.avatarPath,
        blockedAt: row.createdAt.toISOString(),
      })),
    };
  }

  /** What Dily has to look at, oldest first (script). */
  openReports(): Promise<OpenReport[]> {
    return this.prisma.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "asc" },
      include: OPEN_REPORT_INCLUDE,
    });
  }

  /**
   * Dily's decision on a report (script). Removing a listing or suspending
   * an account answers every open report about it at once.
   */
  async resolveReport(
    reportId: string,
    decision: ReportDecision,
  ): Promise<void> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) throw notFound("This report doesn't exist.");
    if (report.status !== "open") {
      throw conflict("This report is already resolved.");
    }
    const now = this.now();
    const resolved = { status: "actioned" as const, resolvedAt: now };

    if (decision === "dismiss") {
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: "dismissed", resolvedAt: now },
      });
      return;
    }

    const { productId, reportedUserId } = report;
    if (decision === "remove") {
      if (!productId) {
        throw new AppError(
          400,
          "validation_error",
          "Only a listing report can remove a listing.",
        );
      }
      const cancelled = await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: { status: "archived" },
        });
        await tx.report.updateMany({
          where: { productId, status: "open" },
          data: resolved,
        });
        return cancelUnpaidOrders(tx, { productId }, now);
      });
      this.announce(cancelled, now);
      return;
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reportedUserId },
        data: { suspendedAt: now },
      });
      // Signed out at the next refresh; the access JWT already fails (auth guard)
      await tx.refreshToken.updateMany({
        where: { userId: reportedUserId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.pushToken.deleteMany({ where: { userId: reportedUserId } });
      await tx.report.updateMany({
        where: { reportedUserId, status: "open" },
        data: resolved,
      });
      return cancelUnpaidOrders(
        tx,
        { OR: [{ buyerId: reportedUserId }, { sellerId: reportedUserId }] },
        now,
      );
    });
    this.announce(cancelled, now);
  }

  private announce(orders: OrderRow[], now: Date) {
    for (const order of orders) {
      for (const id of [order.buyerId, order.sellerId]) {
        this.deps.notifier.send(id, "order:updated", {
          order: toOrder(order, now),
        });
      }
    }
  }
}

/**
 * Ends the agreements not paid yet among `where`: their listings are free
 * again. A payment the payer is confirming right now goes on; once paid,
 * the order goes to its end like any other.
 */
async function cancelUnpaidOrders(
  tx: Prisma.TransactionClient,
  where: Prisma.OrderWhereInput,
  now: Date,
): Promise<OrderRow[]> {
  const unpaid = await tx.order.findMany({
    where: {
      ...where,
      status: "awaiting_payment",
      reservedUntil: { gt: now },
      payments: { none: { status: "pending", expiresAt: { gt: now } } },
    },
  });
  if (unpaid.length === 0) return [];
  await tx.order.updateMany({
    where: {
      id: { in: unpaid.map((order) => order.id) },
      status: "awaiting_payment",
    },
    data: { status: "cancelled" },
  });
  return unpaid.map((order) => ({ ...order, status: "cancelled" }));
}
