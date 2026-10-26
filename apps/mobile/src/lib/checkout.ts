import type { Conversation, Order, PaymentProvider } from "@dily/shared";

import i18n from "@/i18n";
import { amountLabel } from "@/lib/offers";

/** "Orange Money", "Moov Money". */
export const providerName = (provider: PaymentProvider) =>
  provider === "orange_money"
    ? i18n.t("checkout.orangeMoney")
    : i18n.t("checkout.moovMoney");

/** "16 000 F avec Orange Money", "17 200 F livré, avec Orange Money". */
export const paymentLine = (order: Order, provider: PaymentProvider) =>
  i18n.t(
    order.fulfilment === "delivery"
      ? "checkout.payingDelivered"
      : "checkout.paying",
    { amount: amountLabel(order.amount), provider: providerName(provider) },
  );

/**
 * The buyer's order still waiting for payment: an accepted offer (its way
 * of getting the item is agreed) or a direct buy not paid yet.
 */
export const unpaidOrderOf = (conversation: Conversation) => {
  const order = conversation.deal.order;
  return conversation.role === "buyer" && order?.status === "awaiting_payment"
    ? order
    : null;
};

/** "Badalabougou, Bamako" → "Badalabougou". */
export const areaOf = (location: string) =>
  location.split(",")[0]?.trim() ?? location;

/** "1:45" left to confirm. */
export const countdownLabel = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** "Derrière la pharmacie" → "derrière la pharmacie", after "À Hamdallaye ACI, ". */
export const lowerFirst = (text: string) =>
  text.charAt(0).toLocaleLowerCase("fr") + text.slice(1);

/** "70000000" → "70 00 00 00" while typing a number. */
export const groupDigits = (digits: string) =>
  digits.replace(/(\d{2})(?=\d)/g, "$1 ");
