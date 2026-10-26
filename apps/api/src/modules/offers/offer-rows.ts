import type { Offer, OfferStatus, Order, OrderStatus } from "@dily/shared";
import type {
  Offer as OfferRow,
  Order as OrderRow,
} from "../../generated/prisma/client.js";

// Deadlines are read, not swept: a pending offer or an unpaid order past its
// time reads as expired, and is only written so when something touches it

export const offerStatusAt = (
  offer: Pick<OfferRow, "status" | "expiresAt">,
  now: Date,
): OfferStatus =>
  offer.status === "pending" && offer.expiresAt <= now
    ? "expired"
    : offer.status;

export const orderStatusAt = (
  order: Pick<OrderRow, "status" | "reservedUntil">,
  now: Date,
): OrderStatus =>
  order.status === "awaiting_payment" && order.reservedUntil <= now
    ? "expired"
    : order.status;

export const toOffer = (row: OfferRow, now: Date): Offer => ({
  id: row.id,
  conversationId: row.conversationId,
  authorId: row.authorId,
  amount: row.amount,
  fulfilment: row.fulfilment,
  deliveryFee: row.deliveryFee,
  deliveryArea: row.deliveryArea,
  listPrice: row.listPrice,
  status: offerStatusAt(row, now),
  expiresAt: row.expiresAt.toISOString(),
  respondedAt: row.respondedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const toOrder = (row: OrderRow, now: Date): Order => ({
  id: row.id,
  conversationId: row.conversationId,
  productId: row.productId,
  buyerId: row.buyerId,
  sellerId: row.sellerId,
  offerId: row.offerId,
  amount: row.amount,
  listPrice: row.listPrice,
  fulfilment: row.fulfilment,
  deliveryFee: row.deliveryFee,
  deliveryArea: row.deliveryArea,
  status: orderStatusAt(row, now),
  reservedUntil: row.reservedUntil.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
