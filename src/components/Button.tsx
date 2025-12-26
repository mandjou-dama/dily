import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { LucideIcon } from "lucide-react-native";
import React, { memo } from "react";
import {
  Text,
  StyleSheet,
  Pressable,
  PressableProps,
  GestureResponderEvent,
} from "react-native";
import { Spinner } from "./spinner";
import { useHaptics } from "@/hooks/use-haptics";

interface Props extends PressableProps {
  title: string;
  icon?: LucideIcon;
  isLoading?: boolean;
}

const Button = ({ title, icon: Icon, onPress, disabled, isLoading }: Props) => {
  const { impact } = useHaptics();

  const handlePress = (event: GestureResponderEvent) => {
    onPress?.(event);
    impact("light");
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.container, disabled && styles.disabled]}
    >
      {isLoading && <Spinner color={colors.white} size={18} />}
      <Text style={styles.text}>{isLoading ? "Loading..." : title}</Text>
      {Icon && <Icon size={18} color={colors.white} strokeWidth={2} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 13,
    borderCurve: "continuous",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.white,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});

export default memo(Button);
