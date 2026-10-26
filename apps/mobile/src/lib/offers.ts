import { listedTotal, type Fulfilment, type Offer } from "@dily/shared";

import i18n from "@/i18n";
import { ApiRequestError } from "@/lib/api";
import { formatPrice } from "@/lib/format";

// Keeps "17 200 F" and "19 h 38" on one line
const NBSP = "\u00a0";

/** 17200 → "17 200 F", the way the offer and payment screens write prices. */
export const amountLabel = (amount: number) =>
  i18n
    .t("common.amount", {
      amount: formatPrice(amount).replace(/ /g, NBSP),
    })
    .replace(/ F$/, `${NBSP}F`);

/** First name, for "Mamadou demande…". */
export const firstName = (name: string) => name.split(" ")[0] ?? name;

/** What the listing asks for a way of getting the item, delivery included. */
export const askedTotal = (
  price: number,
  deliveryFee: number | null,
  fulfilment: Fulfilment,
) =>
  listedTotal({
    listPrice: price,
    deliveryFee: fulfilment === "delivery" ? deliveryFee : null,
  });

/** What an offer compares to: the listed price when it was made, delivery included. */
export const offerReference = (offer: Offer) =>
  listedTotal({ listPrice: offer.listPrice, deliveryFee: offer.deliveryFee });

// About 4, 8 and 12 % off; deeper ones when rounding makes two the same
const SUGGESTED_DISCOUNTS = [0.04, 0.08, 0.12, 0.16, 0.2, 0.25];
const SUGGESTION_COUNT = 3;

/** Round amounts people would say: 500 F steps, finer for small prices. */
const roundingFor = (amount: number) =>
  amount >= 10_000 ? 500 : amount >= 1_000 ? 100 : 10;

const roundTo = (amount: number, step: number) =>
  Math.round(amount / step) * step;

/**
 * Three amounts to tap: a little, some and a lot below `below`, all above
 * `above` (the offer being answered, for the seller).
 */
export function suggestedAmounts(below: number, above = 0): number[] {
  const step = roundingFor(below);
  const amounts: number[] = [];
  for (const discount of SUGGESTED_DISCOUNTS) {
    if (amounts.length === SUGGESTION_COUNT) break;
    const amount = roundTo(below * (1 - discount), step);
    if (amount > above && amount > 0 && amount < below) {
      if (!amounts.includes(amount)) amounts.push(amount);
    }
  }
  return amounts;
}

/**
 * A counter-offer: three amounts spread between the offer being answered
 * and the price asked. 15 000 F against 17 200 F: 16 700, 16 100, 15 600.
 */
export function suggestedBetween(asked: number, offered: number): number[] {
  const gap = asked - offered;
  if (gap <= 0) return [];
  const step = gap >= 3_000 ? 500 : gap >= 600 ? 100 : 10;
  const amounts = [0.25, 0.5, 0.75]
    .map((share) => roundTo(asked - gap * share, step))
    .filter((amount) => amount > offered && amount < asked);
  return [...new Set(amounts)];
}

/**
 * For a delivered price: a little below, the item's own price (delivery
 * absorbed), and a lot below. 18 700 F with 1 500 F of delivery: 18 000,
 * 17 200, 16 500.
 */
export function suggestedDeliveredAmounts(total: number, price: number) {
  const generic = suggestedAmounts(total);
  if (price <= 0 || price >= total) return generic;
  const little =
    generic.find((amount) => amount > price) ??
    // Small delivery fee: halfway between the price and the total
    roundTo(price + (total - price) / 2, roundingFor(total - price));
  const lot =
    [...generic].reverse().find((amount) => amount < price) ??
    roundTo(price * 0.92, roundingFor(price));
  return [...new Set([little, price, lot])]
    .filter((amount) => amount > 0 && amount < total)
    .sort((a, b) => b - a);
}

/** "1 500 F de moins, livraison comprise", under the amount being offered. */
export function amountNote(
  amount: number,
  reference: number,
  fulfilment: Fulfilment,
) {
  const less = reference - amount;
  if (fulfilment === "delivery") {
    return less > 0
      ? i18n.t("offerSheet.lessDelivered", { amount: amountLabel(less) })
      : i18n.t("offerSheet.askedDelivered");
  }
  return less > 0
    ? i18n.t("offerSheet.less", { amount: amountLabel(less) })
    : i18n.t("offerSheet.asked");
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "16 h", "16 h 05": French clock times. */
const clock = (date: Date) => {
  const minutes = date.getMinutes();
  return minutes === 0
    ? `${date.getHours()}${NBSP}h`
    : `${date.getHours()}${NBSP}h${NBSP}${String(minutes).padStart(2, "0")}`;
};

/** A deadline: "16 h" today, "demain 16 h", then "lundi 16 h". */
export function deadlineLabel(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return i18n.t("time.today", { time: clock(date) });
  if (days === 1) return i18n.t("time.tomorrow", { time: clock(date) });
  return i18n.t("time.later", {
    day: date.toLocaleDateString("fr-FR", { weekday: "long" }),
    time: clock(date),
  });
}

/** What went wrong, in French, for the offer and payment screens. */
export function dealErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "network_error") return i18n.t("errors.network");
    if (error.code === "conflict") return i18n.t("errors.conflict");
    if (error.code === "rate_limited") return i18n.t("errors.rateLimited");
  }
  return i18n.t("errors.generic");
}
