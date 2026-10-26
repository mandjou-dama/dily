import type { PaymentProvider } from "@dily/shared";
import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Smartphone } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { BottomBar, STICKY_BAR_ROOM } from "@/components/checkout/bottom-bar";
import { Card, InfoRow, SectionTitle } from "@/components/checkout/card";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { ProviderLogo } from "@/components/checkout/provider-logo";
import { type Segment, SegmentedControl } from "@/components/segmented-control";
import { useHaptics } from "@/hooks/use-haptics";
import { groupDigits } from "@/lib/checkout";
import { dealErrorMessage } from "@/lib/offers";
import { useAuth } from "@/providers/auth-provider";
import {
  COUNTRY_CODE,
  LOCAL_PHONE_LENGTH,
  normalizeLocalPhone,
  toE164,
} from "@/services/auth.service";
import { useSetPayoutAccount } from "@/services/orders.service";
import { colors } from "@/theme/colors";

const COUNTRY_PREFIX = `+${COUNTRY_CODE}`;
const localPart = (phone: string | undefined) =>
  normalizeLocalPhone(phone?.replace(COUNTRY_PREFIX, "") ?? "");

/**
 * "Recevoir ton argent": the operator and number Dily sends the seller's
 * money to. Payouts waiting for it leave once saved.
 */
export function PayoutAccountScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { notification } = useHaptics();
  const { profile } = useAuth();
  const saved = profile?.payoutAccount ?? null;
  const [provider, setProvider] = useState<PaymentProvider>(
    saved?.provider ?? "orange_money",
  );
  // Their own number to start with: most sellers receive on it
  const [phone, setPhone] = useState(() =>
    localPart(saved?.phone ?? profile?.phone),
  );
  const input = useRef<TextInput>(null);
  const complete = phone.length === LOCAL_PHONE_LENGTH;
  const save = useSetPayoutAccount();

  const onChange = (text: string) => {
    const digits = normalizeLocalPhone(text);
    setPhone(digits);
    // The number pad has no return key: done at the last digit
    if (digits.length === LOCAL_PHONE_LENGTH) input.current?.blur();
  };

  const onSave = () => {
    if (!complete || save.isPending) return;
    save.mutate(
      { provider, phone: toE164(phone) },
      {
        onSuccess: () => {
          notification("success");
          navigation.goBack();
        },
        onError: (error) => {
          notification("error");
          Alert.alert(dealErrorMessage(error));
        },
      },
    );
  };

  const providers: Segment<PaymentProvider>[] = [
    {
      value: "orange_money",
      title: t("checkout.orangeMoney"),
      leading: () => <ProviderLogo provider="orange_money" />,
    },
    {
      value: "moov_money",
      title: t("checkout.moovMoney"),
      leading: () => <ProviderLogo provider="moov_money" />,
    },
  ];

  return (
    <View style={styles.screen}>
      <CheckoutHeader title={t("payout.title")} onBack={navigation.goBack} />
      <KeyboardAwareScrollView
        bottomOffset={STICKY_BAR_ROOM}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.intro}>{t("payout.intro")}</Text>
        <View style={styles.section}>
          <SectionTitle>{t("payout.operator")}</SectionTitle>
          <SegmentedControl
            segments={providers}
            value={provider}
            onChange={setProvider}
            accessibilityLabel={t("payout.operator")}
            surface="background"
            compact
          />
        </View>
        <View style={styles.section}>
          <SectionTitle>{t("payout.number")}</SectionTitle>
          <Card>
            <InfoRow
              icon={
                <Smartphone
                  size={20}
                  color={colors.primary}
                  strokeWidth={1.8}
                />
              }
              value={
                <View style={styles.phone}>
                  <Text style={styles.phoneText}>{COUNTRY_PREFIX}</Text>
                  <TextInput
                    ref={input}
                    value={groupDigits(phone)}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    // The digits and the spaces between their pairs
                    maxLength={LOCAL_PHONE_LENGTH + LOCAL_PHONE_LENGTH / 2 - 1}
                    accessibilityLabel={t("checkout.payingNumberLabel")}
                    style={[styles.phoneText, styles.phoneInput]}
                  />
                </View>
              }
            />
          </Card>
        </View>
      </KeyboardAwareScrollView>
      <BottomBar sticky>
        <ActionButton
          label={t("payout.save")}
          onPress={onSave}
          disabled={!complete}
          isLoading={save.isPending}
          size="large"
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  intro: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.muted,
  },
  section: {
    gap: 10,
  },
  phone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  phoneInput: {
    flex: 1,
    padding: 0,
  },
});
