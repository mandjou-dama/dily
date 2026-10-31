import { memo, type ReactNode } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { colors } from "@/theme/colors";

/** White card with 18 pt corners; its rows are split by hairlines. */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardDivider() {
  return <View style={styles.divider} />;
}

/** A section's title above its card: "Où te livrer ?". */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

type InfoRowProps = {
  icon: ReactNode;
  /** Small grey line above the value ("Quartier"). */
  label?: string;
  /** Or the value itself, when it's not given yet (an input). */
  value?: ReactNode;
  /** Small grey line under the value. */
  detail?: string;
  /** Phone numbers and amounts: digits of the same width. */
  numeric?: boolean;
  trailing?: ReactNode;
};

/** Icon, a value with its label or detail, and a button on the right. */
function InfoRowBase({
  icon,
  label,
  value,
  detail,
  numeric = false,
  trailing,
}: InfoRowProps) {
  return (
    <View style={styles.row}>
      {icon}
      <View style={styles.rowText}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {typeof value === "string" ? (
          <Text style={[styles.value, numeric && styles.numeric]}>{value}</Text>
        ) : (
          value
        )}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export const InfoRow = memo(InfoRowBase);

/** "Changer", "Modifier": the outlined 36 pt button at the end of a row. */
export function SmallButton({
  label,
  onPress,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
    >
      <Text style={styles.smallButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  numeric: {
    fontVariant: ["tabular-nums"],
  },
  detail: {
    fontSize: 13,
    color: colors.muted,
  },
  smallButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  smallButtonLabel: {
    fontSize: 14,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
