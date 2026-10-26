import type { Fulfilment } from "@dily/shared";
import type {
  Order as OrderRow,
  Prisma,
} from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { UserNotifier } from "../realtime/notifier.js";
import { orderStatusAt, toOrder } from "./offer-rows.js";

const conflict = (message: string) => new AppError(409, "conflict", message);
export const unavailable = () => conflict("This item is no longer available.");
export const reservedElsewhere = () =>
  conflict("This item is reserved for another buyer.");

/** Same comparison for the buyer's and the seller's city: free text in profiles. */
const sameCity = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");

/**
 * The buyer's way of getting the item, checked against what the listing
 * offers, with the listing's delivery fee. An offer or a direct buy.
 */
export function buyerTerms(
  input: { fulfilment: Fulfilment; deliveryArea: string | null },
  product: { pickup: boolean; deliveryFee: number | null },
  cities: { buyer: { city: string }; seller: { city: string } },
) {
  if (input.fulfilment === "pickup") {
    if (!product.pickup) {
      throw new AppError(
        400,
        "validation_error",
        "This item is delivery only.",
      );
    }
    return {
      fulfilment: "pickup" as const,
      deliveryFee: null,
      deliveryArea: null,
    };
  }
  if (product.deliveryFee === null) {
    throw new AppError(400, "validation_error", "This item is pickup only.");
  }
  if (!input.deliveryArea) {
    throw new AppError(400, "validation_error", "Say where to deliver.");
  }
  // v1: the seller's courier stays in town
  if (!sameCity(cities.buyer.city, cities.seller.city)) {
    throw new AppError(
      400,
      "validation_error",
      `Delivery is only available in ${cities.seller.city}.`,
    );
  }
  return {
    fulfilment: "delivery" as const,
    deliveryFee: product.deliveryFee,
    deliveryArea: input.deliveryArea,
  };
}

/** A listing's orders still holding it: awaiting payment in time, or paid. */
export async function openOrdersOf(
  db: Prisma.TransactionClient,
  productId: string,
  now: Date,
): Promise<OrderRow[]> {
  const orders = await db.order.findMany({
    where: { productId, status: { in: ["awaiting_payment", "paid"] } },
  });
  return orders.filter((o) => {
    const status = orderStatusAt(o, now);
    return status === "awaiting_payment" || status === "paid";
  });
}

/**
 * Writes unpaid orders past their time as expired, so a new order on the
 * listing can take their place (one open order per listing). Returns them
 * as they were, to tell their participants.
 */
export async function expireLapsedOrders(
  tx: Prisma.TransactionClient,
  productId: string,
  now: Date,
): Promise<OrderRow[]> {
  const lapsed = await tx.order.findMany({
    where: {
      productId,
      status: "awaiting_payment",
      reservedUntil: { lte: now },
    },
  });
  if (lapsed.length > 0) {
    await tx.order.updateMany({
      where: { id: { in: lapsed.map((o) => o.id) } },
      data: { status: "expired" },
    });
  }
  return lapsed;
}

/** Tells both participants of each lapsed order it expired. */
export function announceExpired(
  notifier: UserNotifier,
  lapsed: OrderRow[],
  now: Date,
): void {
  for (const order of lapsed) {
    const expired = toOrder({ ...order, status: "expired" }, now);
    for (const id of [order.buyerId, order.sellerId]) {
      notifier.send(id, "order:updated", { order: expired });
    }
  }
}
