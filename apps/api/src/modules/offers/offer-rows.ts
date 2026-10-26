import type {
  Dispute,
  Offer,
  OfferStatus,
  Order,
  OrderStatus,
  Payment,
  PaymentFailureReason,
  PaymentStatus,
  Transfer,
} from "@dily/shared";
import type {
  Dispute as DisputeRow,
  Offer as OfferRow,
  Order as OrderRow,
  Payment as PaymentRow,
  Transfer as TransferRow,
} from "../../generated/prisma/client.js";

// Deadlines are read, not swept: a pending offer, an unpaid order or an
// unconfirmed payment past its time reads as expired, and is only written so
// when something touches it

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

export const paymentStatusAt = (
  payment: Pick<PaymentRow, "status" | "expiresAt">,
  now: Date,
): PaymentStatus =>
  payment.status === "pending" && payment.expiresAt <= now
    ? "expired"
    : payment.status;

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
  landmark: row.landmark,
  contactPhone: row.contactPhone,
  status: orderStatusAt(row, now),
  reservedUntil: row.reservedUntil.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  refundedAt: row.refundedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const toPayment = (row: PaymentRow, now: Date): Payment => ({
  id: row.id,
  orderId: row.orderId,
  provider: row.provider,
  payerPhone: row.payerPhone,
  amount: row.amount,
  status: paymentStatusAt(row, now),
  // Checked by `payments_failure_reason_check` and the code that writes it
  failureReason: row.failureReason as PaymentFailureReason | null,
  expiresAt: row.expiresAt.toISOString(),
  settledAt: row.settledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const toDispute = (row: DisputeRow): Dispute => ({
  id: row.id,
  orderId: row.orderId,
  reason: row.reason,
  note: row.note,
  photoPaths: row.photoPaths,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
});

export const toTransfer = (row: TransferRow): Transfer => ({
  id: row.id,
  orderId: row.orderId,
  kind: row.kind,
  amount: row.amount,
  provider: row.provider,
  phone: row.phone,
  status: row.status,
  settledAt: row.settledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
