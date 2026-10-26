import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { colors } from "@/theme/colors";

/** The tinted panel at the top of the waiting and paid screens. */
function HeroBase({
  children,
  compact = false,
  tone = "note",
  accessibilityLabel,
}: {
  children: ReactNode;
  /** 112 pt instead of 188: the delivery steps need the room. */
  compact?: boolean;
  tone?: "note" | "warning";
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "summary" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.hero,
        compact && styles.compact,
        tone === "warning" && styles.warning,
      ]}
    >
      {children}
    </View>
  );
}

export const Hero = memo(HeroBase);

/** The big round mark in the hero: a check once paid. */
export function HeroMark({
  compact = false,
  color = colors.primary,
  children,
}: {
  compact?: boolean;
  color?: string;
  children?: ReactNode;
}) {
  const size = compact ? 64 : 72;
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: color },
      ]}
    >
      {children ?? (
        <Check
          size={compact ? 32 : 36}
          color={colors.white}
          strokeWidth={2.6}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 188,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.note,
  },
  compact: {
    height: 112,
  },
  warning: {
    backgroundColor: colors.warning,
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
  },
});
