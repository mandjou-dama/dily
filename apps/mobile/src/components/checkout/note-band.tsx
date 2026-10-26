import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Lock, ShieldCheck } from "lucide-react-native";

import { colors } from "@/theme/colors";

/** The strip at the bottom of a card: Dily keeps the money, or a warning. */
function NoteBandBase({
  tone = "note",
  children,
}: {
  tone?: "note" | "warning";
  children: ReactNode;
}) {
  const warning = tone === "warning";
  const Icon = warning ? Lock : ShieldCheck;
  return (
    <View style={[styles.band, warning && styles.warning]}>
      <Icon
        size={16}
        color={warning ? colors.warningText : colors.primary}
        strokeWidth={2}
        style={styles.icon}
      />
      <Text style={[styles.text, warning && styles.warningText]}>
        {children}
      </Text>
    </View>
  );
}

export const NoteBand = memo(NoteBandBase);

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.note,
  },
  warning: {
    backgroundColor: colors.warning,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.noteText,
  },
  warningText: {
    color: colors.warningText,
  },
});
