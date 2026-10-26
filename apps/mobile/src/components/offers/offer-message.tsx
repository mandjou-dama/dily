import type { Offer } from "@dily/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, MapPin, Truck, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { messageMeta } from "@/lib/chat-labels";
import { messageTime } from "@/lib/format";
import { amountLabel, offerReference } from "@/lib/offers";
import { colors } from "@/theme/colors";

type Props = {
  offer: Offer;
  /** When the message was sent. */
  createdAt: string;
  /** The other person opened it: "10:08 · Lu" on the user's own offers. */
  read: boolean;
  mine: boolean;
  role: "buyer" | "seller";
  /** The other person's first name. */
  otherName: string;
  /** Where pickup happens: the seller's neighbourhood. */
  pickupArea: string;
  /** This offer's answer is on its way. */
  answering: boolean;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onDecline: (offer: Offer) => void;
};

/**
 * An offer in the conversation. The other person's pending offer is a
 * full card with "D'accord", "Autre prix" and "Non merci"; past offers,
 * and the user's own, are compact bubbles: struck through once replaced,
 * declined or expired, with who accepted or declined underneath.
 */
function OfferMessageBase(props: Props) {
  const { offer, mine } = props;
  if (!mine && offer.status === "pending") return <PendingCard {...props} />;
  return <OfferBubble {...props} />;
}

export const OfferMessage = memo(OfferMessageBase);

function PendingCard({
  offer,
  createdAt,
  role,
  otherName,
  pickupArea,
  answering,
  onAccept,
  onCounter,
  onDecline,
}: Props) {
  const { t } = useTranslation();
  const reference = offerReference(offer);
  const less = reference - offer.amount;
  const delivery = offer.fulfilment === "delivery";
  const seller = role === "seller";
  const amount = amountLabel(offer.amount);

  let delta: string | null = null;
  if (less > 0) {
    const value = amountLabel(less);
    delta = seller
      ? t(delivery ? "offerCard.lessThanDelivered" : "offerCard.lessThan", {
          amount: value,
        })
      : t(
          delivery
            ? "offerCard.lessThanAskedDelivered"
            : "offerCard.lessThanAsked",
          { amount: value },
        );
  }
  const Icon = delivery ? Truck : MapPin;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        {t("offerCard.proposesToYou", { name: otherName })}
      </Text>
      <View>
        <View style={styles.amountRow}>
          <Text style={styles.cardAmount}>{amount}</Text>
          {less > 0 ? (
            <Text style={styles.reference}>{amountLabel(reference)}</Text>
          ) : null}
        </View>
        {delta ? <Text style={styles.delta}>{delta}</Text> : null}
      </View>
      <View style={styles.mode}>
        <Icon size={20} color={colors.primary} strokeWidth={1.8} />
        <View style={styles.flex}>
          <Text style={styles.modeTitle}>
            {delivery
              ? t("offerCard.deliveryTo", { area: offer.deliveryArea })
              : seller
                ? t("offerCard.theyComeToYou", { name: otherName })
                : t("offerCard.youGoToThem")}
          </Text>
          <Text style={styles.modeSub}>
            {delivery
              ? seller
                ? t("offerCard.youSendCourier")
                : t("offerCard.theySendCourier", { name: otherName })
              : seller
                ? t("offerCard.atYours", { area: pickupArea })
                : t("offerCard.atTheirs", {
                    name: otherName,
                    area: pickupArea,
                  })}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <ActionButton
          label={t("offerCard.accept", { amount })}
          onPress={() => onAccept(offer)}
          isLoading={answering}
        />
        <View style={styles.row}>
          <ActionButton
            label={t("offerCard.counter")}
            variant="outline"
            onPress={() => onCounter(offer)}
            disabled={answering}
            style={styles.flex}
          />
          <ActionButton
            label={t("offerCard.decline")}
            variant="quiet"
            onPress={() => onDecline(offer)}
            disabled={answering}
            style={styles.flex}
          />
        </View>
      </View>
      <Text style={styles.cardTime}>{messageTime(createdAt)}</Text>
    </View>
  );
}

function OfferBubble({ offer, createdAt, read, mine, otherName }: Props) {
  const { t } = useTranslation();
  const ended =
    offer.status === "superseded" ||
    offer.status === "expired" ||
    offer.status === "declined";

  // Who answered, said from the user's side
  let answer: { text: string; accepted: boolean } | null = null;
  if (offer.status === "accepted") {
    answer = {
      accepted: true,
      text: mine
        ? t("offerCard.theyAccepted", { name: otherName })
        : t("offerCard.youAccepted"),
    };
  } else if (offer.status === "declined") {
    answer = {
      accepted: false,
      text: mine
        ? t("offerCard.theyDeclined", { name: otherName })
        : t("offerCard.youDeclined"),
    };
  }

  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.bubbleMine : styles.bubbleTheirs,
        // Room for the answer underneath
        (answer || !mine) && styles.bubbleWide,
      ]}
    >
      <View style={styles.bubbleBody}>
        <Text style={[styles.bubbleLabel, mine && styles.onGreenMuted]}>
          {mine
            ? t("offerCard.youProposed")
            : t("offerCard.proposes", { name: otherName })}
        </Text>
        <Text
          style={[
            styles.bubbleAmount,
            mine && styles.onGreen,
            ended && styles.struck,
            ended && (mine ? styles.onGreenMuted : styles.muted),
          ]}
        >
          {amountLabel(offer.amount)}
        </Text>
        <Text
          style={[styles.time, styles.bubbleTime, mine && styles.onGreenTime]}
        >
          {messageMeta(messageTime(createdAt), mine && read)}
        </Text>
      </View>
      {answer && offer.respondedAt ? (
        <View
          style={[styles.answer, !answer.accepted && styles.answerDeclined]}
        >
          <View
            style={[
              styles.answerIcon,
              !answer.accepted && styles.answerIconDeclined,
            ]}
          >
            {answer.accepted ? (
              <Check size={12} color={colors.white} strokeWidth={3} />
            ) : (
              <X size={12} color={colors.white} strokeWidth={3} />
            )}
          </View>
          <Text
            style={[
              styles.answerText,
              !answer.accepted && styles.answerTextDeclined,
            ]}
          >
            {answer.text}
          </Text>
          <Text style={styles.time}>{messageTime(offer.respondedAt)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    alignSelf: "flex-start",
    width: 300,
    maxWidth: "88%",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  cardAmount: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  reference: {
    fontSize: 15,
    color: colors.muted,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  delta: {
    marginTop: 2,
    fontSize: 14,
    color: colors.muted,
  },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.background,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  modeSub: {
    fontSize: 13,
    color: colors.muted,
  },
  buttons: {
    gap: 8,
  },
  cardTime: {
    alignSelf: "flex-end",
    fontSize: 11,
    color: colors.muted,
  },
  // A fixed width: the outcome wraps without measuring the bubble twice
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  // The tail is on the sender's side
  bubbleMine: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    backgroundColor: colors.white,
  },
  // A fixed width: the answer's text wraps without measuring twice
  bubbleWide: {
    width: 230,
  },
  bubbleBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  bubbleAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  bubbleTime: {
    alignSelf: "flex-end",
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  muted: {
    color: colors.muted,
  },
  onGreen: {
    color: colors.white,
  },
  onGreenMuted: {
    color: "#DDE5D2",
  },
  onGreenTime: {
    color: colors.success,
  },
  struck: {
    textDecorationLine: "line-through",
  },
  answer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.success,
  },
  answerDeclined: {
    backgroundColor: colors.track,
  },
  answerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  answerIconDeclined: {
    backgroundColor: colors.muted,
  },
  answerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: colors.noteText,
  },
  answerTextDeclined: {
    color: colors.outlineText,
  },
});
