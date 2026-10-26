import {
  listedTotal,
  type Conversation,
  type OrderStatus,
  type Transfer,
} from "@dily/shared";
import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Check, CircleAlert, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { providerName } from "@/lib/checkout";
import { imageUrl } from "@/lib/image";
import { amountLabel, deadlineLabel, firstName } from "@/lib/offers";
import { colors } from "@/theme/colors";

const THUMB_SIZE = 48;

type Props = {
  conversation: Conversation;
  userId: string | undefined;
  onOpenProduct: () => void;
  onMakeOffer: () => void;
  onBuy: () => void;
  onPay: () => void;
  /** The buyer's handover code, once paid. */
  onShowCode: () => void;
  /** The seller types the code, or sees what was reported. */
  onEnterCode: () => void;
  /** Where the seller receives money. */
  onPayoutAccount: () => void;
  /** The seller's payout once handed over, when loaded. */
  payout?: Transfer | null;
};

// Orders still in play: the deal card follows them
const LIVE_ORDER: readonly OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "disputed",
  "completed",
];

/**
 * The listing at the top of the conversation and where the deal stands:
 * "Proposer un prix" / "Acheter" for the buyer, then who waits for whom,
 * the agreed price with "Payer"; once paid, the handover code (buyer) or
 * where to type it (seller), a reported problem, the seller's payout, a
 * refund.
 */
function DealHeaderBase({
  conversation,
  userId,
  onOpenProduct,
  onMakeOffer,
  onBuy,
  onPay,
  onShowCode,
  onEnterCode,
  onPayoutAccount,
  payout,
}: Props) {
  const { t } = useTranslation();
  const { product, deal, otherUser } = conversation;
  const isBuyer = conversation.role === "buyer";
  const name = firstName(otherUser.name);
  const order =
    deal.order && LIVE_ORDER.includes(deal.order.status) ? deal.order : null;
  const pendingForMe =
    deal.offer?.status === "pending" && deal.offer.authorId !== userId
      ? deal.offer
      : null;

  const price = amountLabel(product.price);
  let priceLine: ReactNode;
  // A direct buy is at the listed price: nothing was agreed
  if (order && order.offerId !== null) {
    const agreed = amountLabel(order.amount);
    priceLine = (
      <>
        <Text style={styles.struck}>{amountLabel(listedTotal(order))}</Text>
        {" · "}
        <Text style={styles.agreed}>
          {order.fulfilment === "delivery"
            ? t("deal.agreedDelivered", { amount: agreed })
            : t("deal.agreed", { amount: agreed })}
        </Text>
      </>
    );
  } else if (product.status !== "active") {
    priceLine = t("deal.sold", { price });
  } else if (!isBuyer && product.deliveryFee !== null) {
    priceLine = t("deal.priceWithDelivery", {
      price,
      fee: amountLabel(product.deliveryFee),
    });
  } else if (isBuyer && product.size) {
    priceLine = t("deal.priceWithSize", { price, size: product.size });
  } else {
    priceLine = price;
  }

  let band: ReactNode = null;
  let actions: ReactNode = null;
  const amount = order ? amountLabel(order.amount) : "";
  if (order?.status === "completed") {
    if (isBuyer) {
      band = (
        <Band tone="success" icon="check">
          {t("deal.completedBuyer", { name })}
        </Band>
      );
    } else if (payout?.status === "awaiting_account") {
      band = (
        <Band tone="warning" icon="alert">
          {t("deal.payoutWaiting", { amount })}
        </Band>
      );
      actions = (
        <ActionButton label={t("deal.addPayout")} onPress={onPayoutAccount} />
      );
    } else if (payout?.status === "failed") {
      band = (
        <Band tone="warning" icon="alert">
          {t("deal.payoutFailed", { amount })}
        </Band>
      );
      actions = (
        <ActionButton
          label={t("deal.changePayout")}
          variant="outline"
          onPress={onPayoutAccount}
        />
      );
    } else {
      const provider = payout?.provider ? providerName(payout.provider) : null;
      band = (
        <Band tone="success" icon="check">
          {!provider
            ? t("deal.payoutSoon", { amount })
            : payout?.status === "succeeded"
              ? t("deal.payoutSent", { amount, provider })
              : t("deal.payoutPending", { amount, provider })}
        </Band>
      );
    }
  } else if (order?.status === "disputed") {
    band = (
      <Band tone="warning" icon="alert">
        {isBuyer ? t("deal.disputedBuyer") : t("deal.disputedSeller", { name })}
      </Band>
    );
    actions = isBuyer ? (
      <ActionButton
        label={t("deal.showCode")}
        variant="outline"
        onPress={onShowCode}
      />
    ) : (
      <ActionButton label={t("deal.seeReport")} onPress={onEnterCode} />
    );
  } else if (order?.status === "paid") {
    band = (
      <Band tone="success" icon="check">
        {isBuyer ? t("deal.paidBuyer") : t("deal.paidSeller", { name })}
      </Band>
    );
    actions = (
      <ActionButton
        label={isBuyer ? t("deal.showCode") : t("deal.enterCode")}
        onPress={isBuyer ? onShowCode : onEnterCode}
      />
    );
  } else if (order) {
    const time = deadlineLabel(order.reservedUntil);
    band = (
      <Band tone="success" icon="check">
        {isBuyer
          ? t("deal.reservedForYou", { time })
          : t("deal.reservedForBuyer", { name, time })}
      </Band>
    );
    if (isBuyer) {
      actions = (
        <ActionButton label={t("deal.pay", { amount })} onPress={onPay} />
      );
    }
  } else if (product.status !== "active") {
    // Nothing left to negotiate
  } else if (deal.reservedElsewhereUntil) {
    band = (
      <Band tone="warning" icon="clock">
        {t("deal.reservedElsewhere", {
          time: deadlineLabel(deal.reservedElsewhereUntil),
        })}
      </Band>
    );
  } else if (pendingForMe) {
    band = (
      <Band tone="warning" icon="clock">
        {t("deal.waitingForYou", {
          name,
          time: deadlineLabel(pendingForMe.expiresAt),
        })}
      </Band>
    );
  } else if (isBuyer) {
    actions = (
      <View style={styles.actions}>
        <ActionButton
          label={t("deal.makeOffer")}
          variant="outline"
          onPress={onMakeOffer}
          style={styles.flex}
        />
        <ActionButton
          label={t("deal.buy", { price })}
          onPress={onBuy}
          style={styles.flex}
        />
      </View>
    );
  }

  if (!band && deal.order?.status === "refunded") {
    band = (
      <Band tone="success" icon="check">
        {isBuyer
          ? t("deal.refundedBuyer", { amount: amountLabel(deal.order.amount) })
          : t("deal.refundedSeller")}
      </Band>
    );
  }

  const thumbUri = imageUrl(product.imagePath, THUMB_SIZE * 3);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable
          onPress={onOpenProduct}
          accessibilityRole="button"
          accessibilityHint="Ouvre l'annonce"
          style={({ pressed }) => [styles.product, pressed && styles.pressed]}
        >
          {thumbUri ? (
            <Image
              source={thumbUri}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={1}>
              {product.title}
            </Text>
            <Text style={styles.price} numberOfLines={1}>
              {priceLine}
            </Text>
          </View>
        </Pressable>
        {actions}
      </View>
      {band}
    </View>
  );
}

export const DealHeader = memo(DealHeaderBase);

function Band({
  tone,
  icon,
  children,
}: {
  tone: "success" | "warning";
  icon: "check" | "clock" | "alert";
  children: ReactNode;
}) {
  const color = tone === "success" ? colors.noteText : colors.warningText;
  const Icon =
    icon === "check" ? Check : icon === "clock" ? Clock : CircleAlert;
  return (
    <View
      style={[
        styles.band,
        tone === "success" ? styles.bandSuccess : styles.bandWarning,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={color} strokeWidth={2} />
      <Text style={[styles.bandText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  top: {
    padding: 10,
    gap: 10,
  },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.trackOnBackground,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  price: {
    fontSize: 14,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  struck: {
    textDecorationLine: "line-through",
  },
  agreed: {
    fontWeight: "600",
    color: colors.noteText,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bandSuccess: {
    backgroundColor: colors.success,
  },
  bandWarning: {
    backgroundColor: colors.warning,
  },
  bandText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});
