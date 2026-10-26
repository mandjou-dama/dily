import type { Conversation, Fulfilment, Offer } from "@dily/shared";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import {
  type ComponentRef,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MapPin, Truck } from "lucide-react-native";

import { ActionButton } from "@/components/action-button";
import { type Segment, SegmentedControl } from "@/components/segmented-control";
import { Sheet, type SheetRef } from "@/components/sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { formatPrice } from "@/lib/format";
import {
  amountLabel,
  amountNote,
  askedTotal,
  dealErrorMessage,
  firstName,
  offerReference,
  suggestedAmounts,
  suggestedBetween,
  suggestedDeliveredAmounts,
} from "@/lib/offers";
import { useAuth } from "@/providers/auth-provider";
import { newOfferId, useMakeOffer } from "@/services/offers.service";
import { colors } from "@/theme/colors";

export type OfferSheetRef = {
  /** A new offer, or a counter-offer to `answering`: a fresh form each time. */
  open: (answering: Offer | null) => void;
};

type Props = {
  conversation: Conversation;
};

type Form = {
  fulfilment: Fulfilment;
  area: string;
  editingArea: boolean;
  picked: number | null;
  typing: boolean;
  typed: string;
};

const AMOUNT_MAX_DIGITS = 9;

/**
 * "Ton prix": the buyer picks pickup or delivery and one total, delivery
 * included (suggested amounts, or "Autre" to type it); the seller's
 * counter-offer keeps the buyer's way of getting the item.
 */
export const OfferSheet = forwardRef<OfferSheetRef, Props>(function OfferSheet(
  { conversation },
  ref,
) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { selection, notification } = useHaptics();
  const { product, otherUser } = conversation;
  const isBuyer = conversation.role === "buyer";
  const name = firstName(otherUser.name);
  const canPickup = product.pickup;
  const canDeliver = product.deliveryFee !== null;

  const sheet = useRef<SheetRef>(null);
  const amountInput = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const offerId = useRef(newOfferId());
  const makeOffer = useMakeOffer(conversation.id);

  // The pending offer this one answers: a seller's counter keeps its terms
  const [answering, setAnswering] = useState<Offer | null>(null);
  const lockedBy = (offer: Offer | null) => (!isBuyer && offer ? offer : null);
  const locked = lockedBy(answering);

  // What the amount compares to, and the most it can be
  const referenceFor = (mode: Fulfilment, offer: Offer | null) => {
    const lockedOffer = lockedBy(offer);
    return lockedOffer
      ? offerReference(lockedOffer)
      : askedTotal(product.price, product.deliveryFee, mode);
  };
  // Below what's asked or what the seller answered; for the seller, between
  // the buyer's offer and their own price
  const suggestionsFor = (mode: Fulfilment, offer: Offer | null) => {
    const lockedOffer = lockedBy(offer);
    if (lockedOffer) {
      return suggestedBetween(referenceFor(mode, offer), lockedOffer.amount);
    }
    if (offer?.fulfilment === mode) return suggestedAmounts(offer.amount);
    return mode === "delivery"
      ? suggestedDeliveredAmounts(referenceFor(mode, offer), product.price)
      : suggestedAmounts(referenceFor(mode, offer));
  };
  // Preselected as in the design: the item's own price when delivered,
  // the lowest suggestion for pickup, the middle one when answering
  const defaultPick = (
    mode: Fulfilment,
    offer: Offer | null,
    amounts: number[],
  ) => {
    if (lockedBy(offer) || offer?.fulfilment === mode) {
      return amounts[Math.floor(amounts.length / 2)] ?? null;
    }
    if (mode === "delivery" && amounts.includes(product.price)) {
      return product.price;
    }
    return amounts[amounts.length - 1] ?? null;
  };
  const freshForm = (offer: Offer | null): Form => {
    // Delivery first when the listing has it, as in the design
    const fulfilment =
      offer?.fulfilment ?? (canDeliver ? "delivery" : "pickup");
    const amounts = suggestionsFor(fulfilment, offer);
    return {
      fulfilment,
      area: offer?.deliveryArea ?? profile?.neighbourhood ?? "",
      editingArea: false,
      picked: defaultPick(fulfilment, offer, amounts),
      typing: amounts.length === 0,
      typed: "",
    };
  };
  const [form, setForm] = useState<Form>(() => freshForm(null));
  const update = (changes: Partial<Form>) =>
    setForm((current) => ({ ...current, ...changes }));

  useImperativeHandle(ref, () => ({
    open: (offer) => {
      setAnswering(offer);
      setForm(freshForm(offer));
      offerId.current = newOfferId();
      makeOffer.reset();
      sheet.current?.present();
    },
  }));

  const { fulfilment, area, editingArea, picked, typing, typed } = form;
  const reference = referenceFor(fulfilment, answering);
  const suggestions = suggestionsFor(fulfilment, answering);
  const amount = typing ? Number(typed) || 0 : (picked ?? 0);
  const tooHigh = amount > reference;
  const areaMissing = fulfilment === "delivery" && area.trim() === "";
  const canSend = amount > 0 && !tooHigh && !areaMissing;

  const changeFulfilment = (next: Fulfilment) => {
    // Suggested amounts follow the price asked for that way
    update({
      fulfilment: next,
      picked: defaultPick(next, answering, suggestionsFor(next, answering)),
    });
    makeOffer.reset();
  };

  const pick = (value: number) => {
    selection();
    update({ typing: false, picked: value });
    amountInput.current?.blur();
    makeOffer.reset();
  };

  const startTyping = () => {
    selection();
    update({ typing: true });
    makeOffer.reset();
    requestAnimationFrame(() => amountInput.current?.focus());
  };

  const close = () => sheet.current?.dismiss();

  const send = () => {
    if (!canSend) return;
    makeOffer.mutate(
      {
        id: offerId.current,
        amount,
        fulfilment,
        deliveryArea: fulfilment === "delivery" ? area.trim() : null,
      },
      {
        onSuccess: () => {
          notification("success");
          close();
        },
        onError: () => notification("error"),
      },
    );
  };

  const subtitle = answering
    ? t("offerSheet.proposes", {
        name,
        amount: amountLabel(answering.amount),
      })
    : fulfilment === "delivery"
      ? t("offerSheet.asksDelivered", { name, amount: amountLabel(reference) })
      : t("offerSheet.asks", { name, amount: amountLabel(reference) });

  const sellerArea = isBuyer
    ? otherUser.location.split(",")[0]
    : (profile?.neighbourhood ?? profile?.city ?? "");
  const segments: Segment<Fulfilment>[] = [
    {
      value: "pickup",
      title: t("offerSheet.pickup"),
      subtitle: sellerArea,
      leading: (selected) => (
        <MapPin
          size={20}
          color={selected ? colors.primary : colors.muted}
          strokeWidth={1.8}
        />
      ),
    },
    {
      value: "delivery",
      title: t("offerSheet.delivery"),
      subtitle: product.deliveryFee
        ? t("offerSheet.deliveryFee", {
            fee: amountLabel(product.deliveryFee),
          })
        : t("offerSheet.deliveryIncluded"),
      leading: (selected) => (
        <Truck
          size={20}
          color={selected ? colors.primary : colors.muted}
          strokeWidth={1.8}
        />
      ),
    },
  ];

  const sending = makeOffer.isPending;
  const note = tooHigh
    ? t("offerSheet.tooHigh", { amount: amountLabel(reference) })
    : amountNote(amount, reference, fulfilment);

  return (
    <Sheet
      ref={sheet}
      title={t("offerSheet.title")}
      subtitle={subtitle}
      dismissible={!sending}
      footer={
        <>
          <ActionButton
            label={t("common.cancel")}
            variant="outline"
            onPress={close}
            disabled={sending}
            style={styles.flex}
          />
          <ActionButton
            label={t("offerSheet.send")}
            onPress={send}
            disabled={!canSend}
            isLoading={sending}
            style={styles.flex}
          />
        </>
      }
    >
      {locked ? (
        <LockedFulfilment
          offer={locked}
          sellerArea={sellerArea}
          buyerName={name}
        />
      ) : canPickup && canDeliver ? (
        <SegmentedControl
          segments={segments}
          value={fulfilment}
          onChange={changeFulfilment}
          accessibilityLabel={t("offerSheet.howLabel")}
        />
      ) : null}

      {!locked && fulfilment === "delivery" ? (
        <View style={styles.areaRow}>
          <MapPin size={18} color={colors.primary} strokeWidth={2} />
          {editingArea || area === "" ? (
            <BottomSheetTextInput
              value={area}
              onChangeText={(text) => update({ area: text })}
              placeholder={t("offerSheet.areaPlaceholder")}
              placeholderTextColor={colors.gray}
              autoFocus={editingArea}
              maxLength={60}
              returnKeyType="done"
              // Stays a field while typing, even from empty
              onFocus={() => update({ editingArea: true })}
              onSubmitEditing={() => update({ editingArea: false })}
              onBlur={() => update({ editingArea: false })}
              accessibilityLabel={t("offerSheet.areaLabel")}
              style={styles.areaInput}
            />
          ) : (
            <>
              <Text style={styles.areaText} numberOfLines={1}>
                <Text style={styles.muted}>{t("offerSheet.deliveredTo")}</Text>
                <Text style={styles.strong}>{area}</Text>
              </Text>
              <Pressable
                onPress={() => update({ editingArea: true })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("offerSheet.areaLabel")}
                style={styles.change}
              >
                <Text style={styles.changeText}>{t("common.change")}</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("offerSheet.amountsLabel")}
      >
        {suggestions.map((value) => (
          <Chip
            key={value}
            label={formatPrice(value)}
            selected={!typing && picked === value}
            onPress={() => pick(value)}
          />
        ))}
        <Chip
          label={t("offerSheet.other")}
          selected={typing}
          onPress={startTyping}
        />
      </View>

      <View style={[styles.amountBox, typing && styles.amountBoxTyping]}>
        {typing ? (
          <>
            <Text style={styles.typeLabel}>
              {t("offerSheet.typeYourPrice")}
            </Text>
            <View style={styles.typedRow}>
              <BottomSheetTextInput
                ref={amountInput}
                value={typed ? formatPrice(Number(typed)) : ""}
                onChangeText={(text) => {
                  update({
                    typed: text.replace(/\D/g, "").slice(0, AMOUNT_MAX_DIGITS),
                  });
                  makeOffer.reset();
                }}
                placeholder="0"
                placeholderTextColor={colors.line}
                keyboardType="number-pad"
                autoFocus
                accessibilityLabel={t("offerSheet.typeYourPrice")}
                style={styles.typedInput}
              />
              <Text style={styles.amount}>F</Text>
            </View>
          </>
        ) : (
          <Text style={styles.amount}>{amountLabel(amount)}</Text>
        )}
        <Text
          style={[styles.note, tooHigh && styles.error]}
          accessibilityLiveRegion="polite"
        >
          {amount > 0 ? note : " "}
        </Text>
      </View>

      {makeOffer.isError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {dealErrorMessage(makeOffer.error)}
        </Text>
      ) : null}
    </Sheet>
  );
});

/** The seller's counter-offer: the buyer's way of getting the item, fixed. */
function LockedFulfilment({
  offer,
  sellerArea,
  buyerName,
}: {
  offer: Offer;
  sellerArea: string;
  buyerName: string;
}) {
  const { t } = useTranslation();
  const delivery = offer.fulfilment === "delivery";
  const Icon = delivery ? Truck : MapPin;
  return (
    <View style={styles.locked}>
      <Icon size={20} color={colors.primary} strokeWidth={1.8} />
      <View style={styles.flex}>
        <Text style={styles.strong}>
          {delivery
            ? t("offerSheet.lockedDelivery", { area: offer.deliveryArea })
            : t("offerSheet.lockedPickup", { area: sellerArea })}
        </Text>
        <Text style={styles.lockedHint}>
          {t("offerSheet.lockedHint", { name: buyerName })}
        </Text>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  muted: {
    color: colors.muted,
  },
  strong: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  areaRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.line,
  },
  areaText: {
    flex: 1,
    fontSize: 15,
  },
  areaInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: colors.black,
  },
  change: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.background,
  },
  lockedHint: {
    fontSize: 13,
    color: colors.muted,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  chipTextSelected: {
    color: colors.white,
  },
  amountBox: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.background,
  },
  amountBoxTyping: {
    paddingVertical: 14,
    borderColor: colors.primary,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
  },
  typedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typedInput: {
    minWidth: 60,
    maxWidth: 220,
    padding: 0,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
    textAlign: "right",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  amount: {
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  note: {
    marginTop: 2,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    textAlign: "center",
  },
});
