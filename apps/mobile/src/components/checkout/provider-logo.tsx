import type { PaymentProvider } from "@dily/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

const LOGOS: Record<PaymentProvider, { label: string; color: string }> = {
  orange_money: { label: "OM", color: colors.orangeMoney },
  moov_money: { label: "M", color: colors.moovMoney },
};

/** The operator's square: its initials on its color. */
function ProviderLogoBase({ provider }: { provider: PaymentProvider }) {
  const { label, color } = LOGOS[provider];
  return (
    <View style={[styles.logo, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export const ProviderLogo = memo(ProviderLogoBase);

const styles = StyleSheet.create({
  logo: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
