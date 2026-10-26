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
        { title: t("checkout.stepConfirm", { name }), state: "next" },
      ]
    : [
        { title: t("checkout.stepPaid"), state: "done" },
        {
          title: t("checkout.stepMeet", { name }),
          detail: otherUser.location,
          state: "current",
        },
        { title: t("checkout.stepCheck"), state: "next" },
        { title: t("checkout.stepConfirm", { name }), state: "next" },
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
        contentContainerStyle={[styles.content, delivery && styles.compact]}
        showsVerticalScrollIndicator={false}
      >
        <Hero compact={delivery}>
          <HeroMark compact={delivery} />
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
    gap: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  compact: {
    gap: 16,
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
