import { z } from "zod";
import { phoneE164Schema } from "./phone";

/** Same limit as the `*_delivery_area_length_check` constraints. */
export const DELIVERY_AREA_MAX_LENGTH = 60;
/** Same limit as `orders_landmark_check`. */
export const LANDMARK_MAX_LENGTH = 120;
/** A direct buy holds the listing this long, the time to pay. */
export const DIRECT_BUY_HOLD_MINUTES = 30;
/** The payer has this long to confirm on their phone. */
export const PAYMENT_TTL_SECONDS = 120;
/** Not handed over this many days after payment: the buyer is refunded. */
export const HANDOVER_DAYS = 7;
/** The seller is reminded to hand the item over after these many days. */
export const HANDOVER_REMINDER_DAYS = [2, 5] as const;
/** Digits of the code the buyer gives once they have the item. */
export const HANDOVER_CODE_LENGTH = 4;
/** Same limit as `disputes_note_check`. */
export const DISPUTE_NOTE_MAX_LENGTH = 500;
/** Same limit as `disputes_photos_check`. */
export const DISPUTE_PHOTOS_MAX = 4;

export const fulfilments = ["pickup", "delivery"] as const;
/** Pickup in the seller's neighbourhood, or delivery by a courier the seller sends. */
export const fulfilmentSchema = z.enum(fulfilments);
export type Fulfilment = z.infer<typeof fulfilmentSchema>;

export const orderStatuses = [
  "awaiting_payment",
  "paid",
  // The buyer made a new offer instead of paying, or one of the two
  // blocked the other
  "cancelled",
  // Not paid in time: the listing is free again
  "expired",
  // The item changed hands (handover code, or the buyer confirmed): the
  // money goes to the seller
  "completed",
  // The buyer reported a problem: Dily keeps the money until it's settled
  "disputed",
  // The buyer got their money back: not handed over in time, refunded by
  // the seller, or Dily's decision
  "refunded",
] as const;
export const orderStatusSchema = z.enum(orderStatuses);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** A purchase: an accepted offer, or a direct buy. */
export const orderSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  productId: z.uuid(),
  buyerId: z.uuid(),
  sellerId: z.uuid(),
  // Null for a direct buy
  offerId: z.uuid().nullable(),
  // Total the buyer pays, delivery included
  amount: z.number().int(),
  listPrice: z.number().int(),
  fulfilment: fulfilmentSchema,
  deliveryFee: z.number().int().nullable(),
  deliveryArea: z.string().nullable(),
  // Delivery only, given when paying: for the courier
  landmark: z.string().nullable(),
  contactPhone: phoneE164Schema.nullable(),
  status: orderStatusSchema,
  // While awaiting payment, the listing is held for the buyer until then
  reservedUntil: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  refundedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Order = z.infer<typeof orderSchema>;

export const paymentProviders = ["orange_money", "moov_money"] as const;
export const paymentProviderSchema = z.enum(paymentProviders);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentStatuses = [
  // Waiting for the payer to confirm on their phone
  "pending",
  "succeeded",
  "failed",
  // The buyer gave up waiting ("Je n'ai rien reçu")
  "cancelled",
  // Not confirmed in time
  "expired",
] as const;
export const paymentStatusSchema = z.enum(paymentStatuses);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentFailureReasons = [
  // The payer declined, or got the secret code wrong
  "refused",
  "insufficient_funds",
  // The operator couldn't be reached
  "unavailable",
] as const;
export const paymentFailureReasonSchema = z.enum(paymentFailureReasons);
export type PaymentFailureReason = z.infer<typeof paymentFailureReasonSchema>;

/** One attempt to pay an order with mobile money. */
export const paymentSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  provider: paymentProviderSchema,
  payerPhone: phoneE164Schema,
  amount: z.number().int(),
  status: paymentStatusSchema,
  // Failed payments only
  failureReason: paymentFailureReasonSchema.nullable(),
  // Still pending past this, it's expired
  expiresAt: z.iso.datetime(),
  settledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const disputeReasons = [
  "not_received",
  // Not what the listing showed: a photo is required
  "not_as_described",
  "other",
] as const;
export const disputeReasonSchema = z.enum(disputeReasons);
export type DisputeReason = z.infer<typeof disputeReasonSchema>;

export const disputeStatuses = [
  "open",
  // The buyer got their money back
  "refunded",
  // The money went to the seller
  "released",
] as const;
export const disputeStatusSchema = z.enum(disputeStatuses);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

/** A problem the buyer reported: Dily keeps the money until it's settled. */
export const disputeSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  reason: disputeReasonSchema,
  note: z.string().nullable(),
  // Media paths (`reports/<buyer id>/<id>`)
  photoPaths: z.array(z.string()),
  status: disputeStatusSchema,
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type Dispute = z.infer<typeof disputeSchema>;

export const transferKinds = ["payout", "refund"] as const;
export const transferKindSchema = z.enum(transferKinds);
export type TransferKind = z.infer<typeof transferKindSchema>;

export const transferStatuses = [
  // A payout for a seller who hasn't said where to receive money yet
  "awaiting_account",
  // Sent, waiting for the operator
  "pending",
  "succeeded",
  // Tried again later, or when the seller changes their payout account
  "failed",
] as const;
export const transferStatusSchema = z.enum(transferStatuses);
export type TransferStatus = z.infer<typeof transferStatusSchema>;

/** Money Dily sends: to the seller once handed over, or back to the buyer. */
export const transferSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: transferKindSchema,
  amount: z.number().int(),
  // Null while awaiting the seller's payout account
  provider: paymentProviderSchema.nullable(),
  phone: phoneE164Schema.nullable(),
  status: transferStatusSchema,
  settledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Transfer = z.infer<typeof transferSchema>;

/**
 * `GET /orders/:id`: the order and what each side may see. The buyer gets
 * the latest payment attempt and, until the handover, the code to give;
 * the transfer is the one meant for the user (the seller's payout, the
 * buyer's refund).
 */
export const orderDetailsSchema = z.object({
  order: orderSchema,
  payment: paymentSchema.nullable(),
  handoverCode: z.string().nullable(),
  dispute: disputeSchema.nullable(),
  transfer: transferSchema.nullable(),
});
export type OrderDetails = z.infer<typeof orderDetailsSchema>;

/** `POST /orders`: buying at the listed price, without negotiating. */
export const directBuyBodySchema = z.object({
  conversationId: z.uuid(),
  fulfilment: fulfilmentSchema,
  // Required for delivery, ignored for pickup
  deliveryArea: z
    .string()
    .trim()
    .max(DELIVERY_AREA_MAX_LENGTH)
    .nullish()
    .transform((value) => value || null),
});
export type DirectBuyBody = z.input<typeof directBuyBodySchema>;

/** `POST /orders/:id/payments`: the operator asks the payer to confirm. */
export const paymentBodySchema = z.object({
  // Generated by the app: sending again after a network error never duplicates
  id: z.uuid(),
  provider: paymentProviderSchema,
  payerPhone: phoneE164Schema,
  // Delivery only: where the courier goes, and who they call (the buyer's
  // own number when left out)
  landmark: z
    .string()
    .trim()
    .max(LANDMARK_MAX_LENGTH)
    .nullish()
    .transform((value) => value || null),
  contactPhone: phoneE164Schema.nullish().transform((value) => value ?? null),
});
export type PaymentBody = z.input<typeof paymentBodySchema>;

/** `POST /orders/:id/handover`: the seller types the code the buyer gave. */
export const handoverBodySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${HANDOVER_CODE_LENGTH}}$`)),
});
export type HandoverBody = z.input<typeof handoverBodySchema>;

/** `POST /orders/:id/dispute`: the buyer reports a problem. */
export const disputeBodySchema = z
  .object({
    reason: disputeReasonSchema,
    note: z
      .string()
      .trim()
      .max(DISPUTE_NOTE_MAX_LENGTH)
      .nullish()
      .transform((value) => value || null),
    // Uploaded first with POST /media/report-images
    photoPaths: z
      .array(z.string().min(1).max(200))
      .max(DISPUTE_PHOTOS_MAX)
      .default([]),
  })
  .refine(
    (body) => body.reason !== "not_as_described" || body.photoPaths.length > 0,
    { message: "Add a photo of the item.", path: ["photoPaths"] },
  );
export type DisputeBody = z.input<typeof disputeBodySchema>;
