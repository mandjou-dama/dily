import type { ChatMessage } from "@dily/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CircleAlert, PackageCheck, Undo2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { messageTime } from "@/lib/format";
import { amountLabel } from "@/lib/offers";
import { colors } from "@/theme/colors";

/**
 * What happened to the order once paid, in the chat's history: handed over,
 * a problem reported, refunded.
 */
function OrderEventMessageBase({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const amount = amountLabel(message.order?.amount ?? 0);
  const warning = message.kind === "dispute";
  const Icon =
    message.kind === "handover"
      ? PackageCheck
      : message.kind === "refund"
        ? Undo2
        : CircleAlert;
  const text =
    message.kind === "handover"
      ? t("events.handover", { amount })
      : message.kind === "refund"
        ? t("events.refund", { amount })
        : // The reason, in French from the API
          message.body;
  const color = warning ? colors.warningText : colors.noteText;

  return (
    <View style={styles.row}>
      <View style={[styles.pill, warning && styles.pillWarning]}>
        <Icon size={16} color={color} strokeWidth={2} />
        <Text style={[styles.text, { color }]}>{text}</Text>
        <Text style={[styles.time, { color }]}>
          {messageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export const OrderEventMessage = memo(OrderEventMessageBase);

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    marginVertical: 4,
  },
  pill: {
    maxWidth: "92%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.note,
  },
  pillWarning: {
    backgroundColor: colors.warning,
  },
  text: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  time: {
    fontSize: 12,
    opacity: 0.7,
    fontVariant: ["tabular-nums"],
  },
});
