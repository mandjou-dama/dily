import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme/colors";

/** The buyer's 4-digit handover code, one box per digit. */
function HandoverCodeDigitsBase({
  code,
  compact = false,
}: {
  code: string;
  /** Smaller boxes, inside a card. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t("handover.codeLabel", {
        code: code.split("").join(" "),
      })}
    >
      {code.split("").map((digit, index) => (
        <View key={index} style={[styles.box, compact && styles.boxCompact]}>
          <Text style={[styles.digit, compact && styles.digitCompact]}>
            {digit}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const HandoverCodeDigits = memo(HandoverCodeDigitsBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  box: {
    width: 58,
    height: 68,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.track,
  },
  boxCompact: {
    width: 44,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  digit: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  digitCompact: {
    fontSize: 24,
  },
});
