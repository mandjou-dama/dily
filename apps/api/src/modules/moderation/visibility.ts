import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";

/**
 * People within the viewer's reach: not suspended, and neither blocked the
 * other. Their listings show, and the viewer can write to them.
 */
export const reachableBy = (viewerId: string) =>
  ({
    suspendedAt: null,
    blocksMade: { none: { blockedId: viewerId } },
    blocksReceived: { none: { blockerId: viewerId } },
  }) satisfies Prisma.UserWhereInput;

/**
 * Listings the viewer can open: their own, whatever their status; others'
 * unless removed by Dily or their seller is out of reach.
 */
export const listingVisibleTo = (viewerId: string) =>
  ({
    OR: [
      { sellerId: viewerId },
      { status: { not: "archived" }, seller: reachableBy(viewerId) },
    ],
  }) satisfies Prisma.ProductWhereInput;

export const blockedError = () =>
  new AppError(403, "blocked", "You can't write to this person anymore.");

/**
 * 403 `blocked` once either blocked the other, or the other's account is
 * suspended: no messages, offers or purchases between them.
 */
export async function assertCanWrite(
  prisma: PrismaClient,
  userId: string,
  otherId: string,
): Promise<void> {
  const other = await prisma.user.findFirst({
    where: { id: otherId, ...reachableBy(userId) },
    select: { id: true },
  });
  if (!other) throw blockedError();
}
