import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/spinner";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  subtitle?: string;
  /** Back button on the left; nothing there without it. */
  onBack?: () => void;
  /** Close button on the right. */
  onClose?: () => void;
};

/** The payment screens' header: back, centered title and line, close. */
function CheckoutHeaderBase({ title, subtitle, onBack, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.back")}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <ArrowLeft size={22} color={colors.primary} strokeWidth={1.8} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onClose ? (
        <Pressable
          onPress={onClose}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.close")}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <X size={20} color={colors.primary} strokeWidth={2} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

export const CheckoutHeader = memo(CheckoutHeaderBase);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  spacer: {
    width: 44,
    height: 44,
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
  },
});

/** A payment screen whose data isn't there yet: its header and a spinner. */
export function CheckoutLoading(props: Props) {
  return (
    <View style={fallbackStyles.screen}>
      <CheckoutHeader {...props} />
      <View style={fallbackStyles.center}>
        <Spinner color={colors.primary} size={28} />
      </View>
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
