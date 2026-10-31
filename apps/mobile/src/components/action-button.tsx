import { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Spinner } from "@/components/spinner";
import { colors } from "@/theme/colors";

type Variant = "primary" | "outline" | "soft" | "quiet";

type Props = {
  label: string;
  onPress: () => void;
  /**
   * Primary: filled green; outline: green border; soft: beige like the
   * screen, on a white card; quiet: grey border ("Non merci").
   */
  variant?: Variant;
  disabled?: boolean;
  isLoading?: boolean;
  /** 44 pt in cards and sheets, 48 pt at the bottom of a screen. */
  size?: "regular" | "large";
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * The design's buttons: 13 pt continuous corners and a 14 pt regular label,
 * like the onboarding's sign-in buttons.
 */
function ActionButtonBase({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  isLoading = false,
  size = "regular",
  style,
  accessibilityHint,
}: Props) {
  const inactive = disabled || isLoading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: isLoading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        size === "large" && styles.large,
        styles[variant],
        disabled && variant === "primary" && styles.primaryDisabled,
        (pressed || isLoading) && styles.pressed,
        style,
      ]}
    >
      {isLoading ? (
        <Spinner
          size={16}
          color={variant === "primary" ? colors.white : colors.primary}
        />
      ) : null}
      <Text style={[styles.label, styles[`${variant}Label`]]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export const ActionButton = memo(ActionButtonBase);

const styles = StyleSheet.create({
  button: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderCurve: "continuous",
  },
  large: {
    height: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryDisabled: {
    backgroundColor: colors.disabled,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  soft: {
    backgroundColor: colors.background,
  },
  quiet: {
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.75,
  },
  // As the onboarding's sign-in buttons: 14 pt, regular weight
  label: {
    fontSize: 14,
    fontWeight: "400",
  },
  primaryLabel: {
    color: colors.white,
  },
  outlineLabel: {
    color: colors.primary,
  },
  softLabel: {
    color: colors.primary,
  },
  quietLabel: {
    color: colors.outlineText,
  },
});
