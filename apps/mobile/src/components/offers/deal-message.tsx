import type { Order } from "@dily/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { amountLabel } from "@/lib/offers";
import { colors } from "@/theme/colors";

type Props = {
  order: Order;
  role: "buyer" | "seller";
  otherName: string;
  /** Hidden until the payment screens exist. */
  onPay?: (order: Order) => void;
};

/** "Marché conclu": the agreed total and, for the buyer, "Payer"; then paid. */
function DealMessageBase({ order, role, otherName, onPay }: Props) {
  const { t } = useTranslation();
  const isBuyer = role === "buyer";
  const amount = amountLabel(order.amount);
  const paid = order.status === "paid";
  const waiting = order.status === "awaiting_payment";

  let status: string | null = null;
  if (order.status === "expired") status = t("dealCard.expired");
  else if (order.status === "cancelled") status = t("dealCard.cancelled");
  else if (waiting) {
    status = isBuyer
      ? t("dealCard.providers")
      : t("dealCard.awaitingPayment", { name: otherName });
  }

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <View style={styles.center}>
          <Text style={styles.label}>
            {paid ? t("dealCard.paid") : t("dealCard.agreed")}
          </Text>
          <Text style={[styles.amount, !paid && !waiting && styles.struck]}>
            {amount}
          </Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
        {isBuyer && waiting && onPay ? (
          <ActionButton
            label={t("deal.pay", { amount })}
            onPress={() => onPay(order)}
          />
        ) : null}
      </View>
      {paid || waiting ? (
        <View style={styles.note}>
          <ShieldCheck size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.noteText}>
            {isBuyer
              ? t("dealCard.buyerNote", { name: otherName })
              : t("dealCard.sellerNote", { name: otherName })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const DealMessage = memo(DealMessageBase);

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    marginTop: 6,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  body: {
    gap: 10,
    padding: 14,
  },
  center: {
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
  },
  amount: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  struck: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  status: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.note,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.noteText,
  },
});
