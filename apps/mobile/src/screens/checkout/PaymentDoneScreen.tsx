import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  StackActions,
  type StaticScreenProps,
  useNavigation,
} from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { BottomBar } from "@/components/checkout/bottom-bar";
import { Card } from "@/components/checkout/card";
import {
  CheckoutHeader,
  CheckoutLoading,
} from "@/components/checkout/checkout-header";
import { Hero, HeroMark } from "@/components/checkout/hero";
import { NoteBand } from "@/components/checkout/note-band";
import { type Step, StepList } from "@/components/checkout/step-list";
import { HandoverCodeDigits } from "@/components/handover/handover-code";
import { lowerFirst, paymentLine } from "@/lib/checkout";
import { formatPhone } from "@/lib/format";
import { amountLabel, firstName } from "@/lib/offers";
import { useConversation } from "@/services/chat.service";
import { useOrderDetails } from "@/services/orders.service";
import { colors } from "@/theme/colors";

// Static navigation reads the params type from here
type Props = StaticScreenProps<{ conversationId: string; orderId: string }>;

/** Paid: what happens next, pickup or delivery. */
export const PaymentDoneScreen = ({ route }: Props) => {
  const { conversationId, orderId } = route.params;
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { data } = useOrderDetails(orderId);
  const { data: conversation } = useConversation(conversationId);

  if (!data || !conversation) {
    return (
      <CheckoutLoading
        title={t("checkout.paidTitle")}
        onClose={navigation.goBack}
      />
    );
  }

  const { order, payment } = data;
  const { otherUser } = conversation;
  const name = firstName(otherUser.name);
  const delivery = order.fulfilment === "delivery";
  const toChat = () =>
    navigation.dispatch(
      StackActions.popTo("Conversation", { id: conversationId }),
    );

  const steps: Step[] = delivery
    ? [
        { title: t("checkout.stepPaid"), state: "done" },
        {
          title: t("checkout.stepCourier", { name }),
          detail: order.landmark
            ? t("checkout.stepCourierWhereLandmark", {
                area: order.deliveryArea,
                landmark: lowerFirst(order.landmark),
              })
            : t("checkout.stepCourierWhere", { area: order.deliveryArea }),
          state: "current",
        },
        {
          title: t("checkout.stepCall"),
          detail: order.contactPhone
            ? t("checkout.stepCallAt", {
                phone: formatPhone(order.contactPhone),
              })
            : undefined,
          state: "next",
        },
        { title: t("checkout.stepCheckCourier"), state: "next" },
        { title: t("checkout.stepCodeCourier"), state: "next" },
      ]
    : [
        { title: t("checkout.stepPaid"), state: "done" },
        {
          title: t("checkout.stepMeet", { name }),
          detail: otherUser.location,
          state: "current",
        },
        { title: t("checkout.stepCheck"), state: "next" },
        { title: t("checkout.stepCode", { name }), state: "next" },
      ];

  return (
    <View style={styles.screen}>
      <CheckoutHeader
        title={t("checkout.paidTitle")}
        subtitle={
          payment
            ? paymentLine(order, payment.provider)
            : amountLabel(order.amount)
        }
        onClose={navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact: the code needs the room */}
        <Hero compact>
          <HeroMark compact />
        </Hero>
        <View>
          <Text style={styles.headline} accessibilityRole="header">
            {t("checkout.paidHeadline")}
          </Text>
          <Text style={styles.body}>
            {delivery
              ? t("checkout.paidDeliveryBody", { name })
              : t("checkout.paidPickupBody")}
          </Text>
        </View>
        {data.handoverCode ? (
          <Card style={styles.code}>
            <Text style={styles.codeTitle}>{t("handover.codeTitle")}</Text>
            <Text style={styles.codeHint}>
              {delivery
                ? t("handover.codeForCourier")
                : t("handover.codeForSeller", { name })}
            </Text>
            <View style={styles.codeDigits}>
              <HandoverCodeDigits code={data.handoverCode} compact />
            </View>
          </Card>
        ) : null}
        <Card>
          <StepList steps={steps} />
          <NoteBand>
            {delivery ? t("checkout.paidNoteDelivery") : t("checkout.paidNote")}
          </NoteBand>
        </Card>
      </ScrollView>
      <BottomBar roomy>
        <ActionButton
          label={t("checkout.writeTo", { name })}
          onPress={toChat}
          size="large"
        />
      </BottomBar>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 16,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  code: {
    gap: 2,
    padding: 14,
  },
  codeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  codeHint: {
    fontSize: 13,
    color: colors.muted,
  },
  codeDigits: {
    marginTop: 10,
  },
  headline: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.black,
  },
  body: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    color: colors.muted,
  },
});
