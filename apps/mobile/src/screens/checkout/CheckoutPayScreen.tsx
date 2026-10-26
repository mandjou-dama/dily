import {
  type Conversation,
  type Fulfilment,
  type Order,
  type PaymentProvider,
} from "@dily/shared";
import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import {
  type StaticScreenProps,
  useNavigation,
} from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { MapPin, Smartphone, Truck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { BottomBar, STICKY_BAR_ROOM } from "@/components/checkout/bottom-bar";
import {
  Card,
  CardDivider,
  InfoRow,
  SectionTitle,
  SmallButton,
} from "@/components/checkout/card";
import {
  CheckoutHeader,
  CheckoutLoading,
} from "@/components/checkout/checkout-header";
import { NoteBand } from "@/components/checkout/note-band";
import { ProductSummary } from "@/components/checkout/product-summary";
import { type Segment, SegmentedControl } from "@/components/segmented-control";
import { useHaptics } from "@/hooks/use-haptics";
import { ApiRequestError } from "@/lib/api";
import { areaOf, unpaidOrderOf } from "@/lib/checkout";
import { formatPhone } from "@/lib/format";
import { amountLabel, dealErrorMessage } from "@/lib/offers";
import { useAuth } from "@/providers/auth-provider";
import {
  COUNTRY_CODE,
  LOCAL_PHONE_LENGTH,
  normalizeLocalPhone,
  toE164,
} from "@/services/auth.service";
import { useConversation } from "@/services/chat.service";
import { newPaymentId, useDirectBuy, usePay } from "@/services/orders.service";
import { colors } from "@/theme/colors";

type Params = {
  conversationId: string;
  fulfilment: Fulfilment;
  deliveryArea: string | null;
  landmark: string | null;
};

// Static navigation reads the params type from here
type Props = StaticScreenProps<Params>;

const ICON = 20;
const COUNTRY_PREFIX = `+${COUNTRY_CODE}`;

/** Step 2 of paying: the operator, the number that pays, the total. */
export const CheckoutPayScreen = ({ route }: Props) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { data: conversation } = useConversation(route.params.conversationId);

  if (!conversation) {
    return (
      <CheckoutLoading
        title={t("checkout.payTitle")}
        subtitle={t("checkout.step", { current: 2, total: 2 })}
        onBack={navigation.goBack}
      />
    );
  }
  return <PayStep conversation={conversation} {...route.params} />;
};

const PayStep = ({
  conversation,
  fulfilment,
  deliveryArea,
  landmark,
}: Params & { conversation: Conversation }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { impact, notification } = useHaptics();
  const { profile } = useAuth();
  const { product, otherUser } = conversation;
  const delivery = fulfilment === "delivery";
  const unpaid = unpaidOrderOf(conversation);
  const agreed = unpaid?.offerId ? unpaid : null;

  const deliveryFee = delivery ? (product.deliveryFee ?? 0) : 0;
  const total = agreed ? agreed.amount : product.price + deliveryFee;

  const [provider, setProvider] = useState<PaymentProvider>("orange_money");
  // The buyer's own number, or another one (a relative's account)
  const [payer, setPayer] = useState(() =>
    normalizeLocalPhone(profile?.phone.replace(COUNTRY_PREFIX, "") ?? ""),
  );
  const [editingPayer, setEditingPayer] = useState(false);
  const payerComplete = payer.length === LOCAL_PHONE_LENGTH;
  const payerInput = useRef<TextInput>(null);
  const onPayerChange = (text: string) => {
    const digits = normalizeLocalPhone(text);
    setPayer(digits);
    // The whole number typed: done, as the number pad has no return key
    if (digits.length === LOCAL_PHONE_LENGTH) payerInput.current?.blur();
  };

  const { mutateAsync: buy, isPending: isBuying } = useDirectBuy();
  const { mutateAsync: pay, isPending: isPaying } = usePay();
  const busy = isBuying || isPaying;
  // A direct buy's order, made at the first "Payer", kept for the next tries
  const directOrder = useRef<Order | null>(null);
  // Kept across retries of the same attempt after a network error
  const attemptId = useRef(newPaymentId());

  /** The order to pay: agreed, or a direct buy on these terms. */
  const orderToPay = async () => {
    if (agreed) return agreed;
    if (directOrder.current) return directOrder.current;
    const sameTerms =
      unpaid &&
      unpaid.fulfilment === fulfilment &&
      unpaid.deliveryArea === deliveryArea;
    // Another unpaid direct buy is replaced by the new one
    return sameTerms
      ? unpaid
      : buy({ conversationId: conversation.id, fulfilment, deliveryArea });
  };

  const onPay = async () => {
    if (busy || !payerComplete) return;
    impact("light");
    try {
      const order = await orderToPay();
      if (!agreed) directOrder.current = order;
      const payment = await pay({
        order,
        id: attemptId.current,
        provider,
        payerPhone: toE164(payer),
        landmark,
      });
      attemptId.current = newPaymentId();
      navigation.navigate("PaymentPending", {
        conversationId: conversation.id,
        orderId: order.id,
        paymentId: payment.id,
      });
    } catch (error) {
      // The order lapsed or changed: the next try starts from the server's
      if (error instanceof ApiRequestError && error.code === "conflict") {
        directOrder.current = null;
      }
      notification("error");
      Alert.alert(dealErrorMessage(error));
    }
  };

  const providers: Segment<PaymentProvider>[] = [
    {
      value: "orange_money",
      title: t("checkout.orangeMoney"),
      leading: () => <ProviderLogo label="OM" color={colors.orangeMoney} />,
    },
    {
      value: "moov_money",
      title: t("checkout.moovMoney"),
      leading: () => <ProviderLogo label="M" color={colors.moovMoney} />,
    },
  ];

  const priceLabel = agreed
    ? t(delivery ? "checkout.agreedPriceDelivered" : "checkout.agreedPrice")
    : t("checkout.price");

  return (
    <View style={styles.screen}>
      <CheckoutHeader
        title={t("checkout.payTitle")}
        subtitle={t("checkout.step", { current: 2, total: 2 })}
        onBack={navigation.goBack}
      />
      <KeyboardAwareScrollView
        bottomOffset={STICKY_BAR_ROOM}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card>
          <ProductSummary product={product} agreed={agreed} />
          <CardDivider />
          <InfoRow
            icon={
              delivery ? (
                <Truck size={ICON} color={colors.primary} strokeWidth={1.8} />
              ) : (
                <MapPin size={ICON} color={colors.primary} strokeWidth={1.8} />
              )
            }
            value={
              delivery
                ? t("checkout.deliveredTo", { area: deliveryArea })
                : t("checkout.pickupAt", { area: areaOf(otherUser.location) })
            }
            detail={
              delivery
                ? (landmark ?? t("checkout.noLandmark"))
                : t("checkout.pickupHint")
            }
            trailing={
              <SmallButton
                label={t("checkout.modify")}
                onPress={navigation.goBack}
              />
            }
          />
        </Card>

        <View style={styles.section}>
          <SectionTitle>{t("checkout.payWith")}</SectionTitle>
          <SegmentedControl
            segments={providers}
            value={provider}
            onChange={setProvider}
            accessibilityLabel={t("checkout.payWith")}
            surface="background"
            compact
          />
        </View>

        <Card>
          <InfoRow
            icon={
              <Smartphone
                size={ICON}
                color={colors.primary}
                strokeWidth={1.8}
              />
            }
            label={t("checkout.payingNumber")}
            value={
              editingPayer ? (
                <View style={styles.phone}>
                  <Text style={styles.phoneText}>{COUNTRY_PREFIX}</Text>
                  <TextInput
                    ref={payerInput}
                    value={groupDigits(payer)}
                    onChangeText={onPayerChange}
                    onBlur={() => setEditingPayer(!payerComplete)}
                    autoFocus
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    // The digits and the spaces between their pairs
                    maxLength={LOCAL_PHONE_LENGTH + LOCAL_PHONE_LENGTH / 2 - 1}
                    accessibilityLabel={t("checkout.payingNumberLabel")}
                    style={[styles.phoneText, styles.phoneInput]}
                  />
                </View>
              ) : (
                formatPhone(toE164(payer))
              )
            }
            numeric
            trailing={
              editingPayer ? null : (
                <SmallButton
                  label={t("checkout.change")}
                  onPress={() => setEditingPayer(true)}
                />
              )
            }
          />
          <CardDivider />
          <View style={styles.amounts}>
            <AmountRow
              label={priceLabel}
              value={amountLabel(agreed ? total : product.price)}
            />
            {!agreed && delivery ? (
              <AmountRow
                label={t("checkout.deliveryLine")}
                value={amountLabel(deliveryFee)}
              />
            ) : null}
            <View style={[styles.amountRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>{t("checkout.total")}</Text>
              <Text style={styles.totalValue}>{amountLabel(total)}</Text>
            </View>
          </View>
          <NoteBand>{t("checkout.protected")}</NoteBand>
        </Card>
      </KeyboardAwareScrollView>

      <BottomBar sticky>
        <ActionButton
          label={t("checkout.pay", { amount: amountLabel(total) })}
          onPress={onPay}
          disabled={!payerComplete}
          isLoading={busy}
          size="large"
        />
      </BottomBar>
    </View>
  );
};

/** "70000000" → "70 00 00 00" while typing. */
const groupDigits = (digits: string) => digits.replace(/(\d{2})(?=\d)/g, "$1 ");

/** The operator's square: its initials on its color. */
const ProviderLogo = ({ label, color }: { label: string; color: string }) => (
  <View style={[styles.logo, { backgroundColor: color }]}>
    <Text style={styles.logoText}>{label}</Text>
  </View>
);

const AmountRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.amountRow}>
    <Text style={styles.amountLabel}>{label}</Text>
    <Text style={styles.amountValue}>{value}</Text>
  </View>
);

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
  section: {
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  phone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  phoneText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  phoneInput: {
    flex: 1,
    padding: 0,
  },
  amounts: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  amountLabel: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.muted,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  totalRow: {
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
});
