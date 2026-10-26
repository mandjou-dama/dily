import type { Payment } from "@dily/shared";
import { memo, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CommonActions,
  type StaticScreenProps,
  useNavigation,
  usePreventRemove,
} from "@react-navigation/native";
import { X } from "lucide-react-native";
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
import { RingSpinner } from "@/components/checkout/ring-spinner";
import { StepList } from "@/components/checkout/step-list";
import { useHaptics } from "@/hooks/use-haptics";
import { countdownLabel, paymentLine, providerName } from "@/lib/checkout";
import { useCancelPayment, useOrderDetails } from "@/services/orders.service";
import { colors } from "@/theme/colors";

type Params = { conversationId: string; orderId: string; paymentId: string };

// Static navigation reads the params type from here
type Props = StaticScreenProps<Params>;

type Failure = "refused" | "insufficient_funds" | "unavailable" | "expired";

const FAILURE_COPY = {
  refused: ["checkout.failedRefused", "checkout.failedRefusedBody"],
  insufficient_funds: ["checkout.failedFunds", "checkout.failedFundsBody"],
  unavailable: ["checkout.failedUnavailable", "checkout.failedUnavailableBody"],
  expired: ["checkout.failedExpired", "checkout.failedExpiredBody"],
} as const;

const failureOf = (payment: Payment): Failure | null => {
  if (payment.status === "expired") return "expired";
  if (payment.status === "failed") return payment.failureReason ?? "refused";
  return null;
};

/**
 * The operator asks the payer to confirm on their phone: waiting, with the
 * time left, until it's paid (then the paid screen) or it fails.
 */
export const PaymentPendingScreen = ({ route }: Props) => {
  const { conversationId, orderId, paymentId } = route.params;
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { notification } = useHaptics();
  const { data, refetch } = useOrderDetails(orderId, { poll: true });
  const { mutate: cancel, isPending: isCancelling } = useCancelPayment();

  const payment = data?.payment?.id === paymentId ? data.payment : null;
  const status = payment?.status;
  const failure = payment ? failureOf(payment) : null;
  const waiting = status === "pending";

  // Android's back button while waiting: the same as "Je n'ai rien reçu"
  const onNothingReceived = () =>
    cancel({ orderId, paymentId }, { onError: () => void refetch() });
  usePreventRemove(waiting, onNothingReceived);

  // Paid: the paid screen replaces the payment steps, back goes to the chat
  const finished = useRef(false);
  useEffect(() => {
    if (status === "succeeded" && !finished.current) {
      finished.current = true;
      notification("success");
      navigation.dispatch((state) => {
        const start = state.routes.findIndex(
          (screen) => screen.name === "Checkout",
        );
        const kept = state.routes.slice(0, start === -1 ? -1 : start);
        const routes = [
          ...kept,
          {
            key: `PaymentDone-${orderId}`,
            name: "PaymentDone",
            params: { conversationId, orderId },
          },
        ];
        return CommonActions.reset({
          ...state,
          routes,
          index: routes.length - 1,
        });
      });
    } else if (status === "cancelled") {
      // Back to step 2, to pay again
      navigation.goBack();
    }
  }, [status, navigation, notification, conversationId, orderId]);

  useEffect(() => {
    if (failure) notification("error");
  }, [failure, notification]);

  if (!data || !payment) {
    return <CheckoutLoading title={t("checkout.payTitle")} />;
  }

  const provider = providerName(payment.provider);
  const header = (
    <CheckoutHeader
      title={t("checkout.payTitle")}
      subtitle={paymentLine(data.order, payment.provider)}
      onBack={failure ? navigation.goBack : undefined}
    />
  );

  if (failure) {
    const [title, body] = FAILURE_COPY[failure];
    return (
      <View style={styles.screen}>
        {header}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Hero tone="warning">
            <HeroMark color={colors.warningText}>
              <X size={36} color={colors.white} strokeWidth={2.6} />
            </HeroMark>
          </Hero>
          <View accessibilityRole="alert">
            <Text style={styles.headline}>{t(title)}</Text>
            <Text style={styles.body}>{t(body, { provider })}</Text>
          </View>
        </ScrollView>
        <BottomBar roomy>
          <ActionButton
            label={t("checkout.tryAgain")}
            onPress={navigation.goBack}
            size="large"
          />
        </BottomBar>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Hero accessibilityLabel={t("checkout.waitingLabel")}>
          <RingSpinner size={72} thickness={6} track={colors.noteRing} />
        </Hero>
        <Text style={styles.headline} accessibilityRole="header">
          {t("checkout.confirmTitle")}
        </Text>
        <Card>
          <StepList
            steps={[
              {
                title: t("checkout.confirmStep1", { provider }),
                state: "plain",
              },
              {
                title: t("checkout.confirmStep2", { provider }),
                state: "plain",
              },
              { title: t("checkout.confirmStep3"), state: "plain" },
            ]}
          />
          <NoteBand tone="warning">{t("checkout.neverShareCode")}</NoteBand>
        </Card>
        <View style={styles.spacer} />
        {waiting ? (
          <WaitingLine
            expiresAt={payment.expiresAt}
            onElapsed={() => void refetch()}
          />
        ) : null}
      </ScrollView>
      <BottomBar roomy>
        <ActionButton
          label={t("checkout.nothingReceived")}
          onPress={onNothingReceived}
          variant="outline"
          isLoading={isCancelling}
          disabled={!waiting}
          size="large"
          style={styles.transparent}
        />
      </BottomBar>
    </View>
  );
};

/**
 * "En attente de ta confirmation 1:45". Its own component: only the time
 * renders again each second. At zero the server says what happened.
 */
const WaitingLine = memo(function WaitingLine({
  expiresAt,
  onElapsed,
}: {
  expiresAt: string;
  onElapsed: () => void;
}) {
  const { t } = useTranslation();
  const deadline = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => deadline - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const next = deadline - Date.now();
      setLeft(next);
      if (next <= 0) {
        clearInterval(timer);
        onElapsed();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, onElapsed]);

  return (
    <View style={styles.waiting}>
      <RingSpinner size={20} thickness={3} track={colors.success} />
      <Text style={styles.waitingText}>{t("checkout.waiting")}</Text>
      <Text style={styles.waitingTime}>{countdownLabel(left)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
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
  spacer: {
    flex: 1,
  },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  waitingText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  waitingTime: {
    fontSize: 15,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  transparent: {
    backgroundColor: "transparent",
  },
});
