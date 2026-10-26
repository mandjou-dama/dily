import {
  type Conversation,
  type Dispute,
  HANDOVER_CODE_LENGTH,
} from "@dily/shared";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { CircleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { Sheet, type SheetRef } from "@/components/sheet";
import { useHaptics } from "@/hooks/use-haptics";
import i18n from "@/i18n";
import { ApiRequestError } from "@/lib/api";
import { imageUrl } from "@/lib/image";
import { amountLabel, dealErrorMessage, firstName } from "@/lib/offers";
import {
  useHandover,
  useOrderDetails,
  useRefundBuyer,
} from "@/services/orders.service";
import { colors } from "@/theme/colors";

export type EnterCodeSheetRef = { open: () => void };

type Props = {
  conversation: Conversation;
  orderId: string;
};

const PHOTO_SIZE = 64;

/**
 * The seller types the code the buyer gives once they have the item: the
 * money leaves for the seller. A reported problem shows on top; the buyer
 * can be refunded from here too.
 */
export const EnterCodeSheet = forwardRef<EnterCodeSheetRef, Props>(
  function EnterCodeSheet({ conversation, orderId }, ref) {
    const { t } = useTranslation();
    const { notification } = useHaptics();
    const sheet = useRef<SheetRef>(null);
    const buyer = firstName(conversation.otherUser.name);
    const { data } = useOrderDetails(orderId);
    const handover = useHandover();
    const refund = useRefundBuyer();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const busy = handover.isPending || refund.isPending;
    const dispute = data?.dispute?.status === "open" ? data.dispute : null;
    const amount = amountLabel(data?.order.amount ?? 0);

    useImperativeHandle(ref, () => ({
      open: () => {
        setCode("");
        setError(null);
        handover.reset();
        sheet.current?.present();
      },
    }));

    const onValidate = () => {
      if (code.length !== HANDOVER_CODE_LENGTH || busy) return;
      setError(null);
      handover.mutate(
        { orderId, code },
        {
          onSuccess: () => {
            notification("success");
            sheet.current?.dismiss();
          },
          onError: (failure) => {
            notification("error");
            setError(codeErrorMessage(failure, buyer));
          },
        },
      );
    };

    const onRefund = () =>
      Alert.alert(
        t("handover.refundTitle", { name: buyer }),
        t("handover.refundBody", { amount }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("handover.refund", { name: buyer }),
            style: "destructive",
            onPress: () =>
              refund.mutate(orderId, {
                onSuccess: () => {
                  notification("success");
                  sheet.current?.dismiss();
                },
                onError: (failure) => {
                  notification("error");
                  Alert.alert(dealErrorMessage(failure));
                },
              }),
          },
        ],
      );

    return (
      <Sheet
        ref={sheet}
        title={t("handover.enterTitle")}
        subtitle={t("handover.enterSubtitle", { name: buyer })}
        dismissible={!busy}
      >
        {dispute ? <DisputeSummary dispute={dispute} buyer={buyer} /> : null}
        <View style={styles.field}>
          <BottomSheetTextInput
            value={code}
            onChangeText={(text) => {
              setError(null);
              setCode(text.replace(/\D/g, "").slice(0, HANDOVER_CODE_LENGTH));
            }}
            onSubmitEditing={onValidate}
            keyboardType="number-pad"
            maxLength={HANDOVER_CODE_LENGTH}
            placeholder="····"
            placeholderTextColor={colors.disabled}
            accessibilityLabel={t("handover.enterLabel")}
            style={[styles.input, error && styles.inputError]}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
        <ActionButton
          label={t("handover.validate")}
          onPress={onValidate}
          disabled={code.length !== HANDOVER_CODE_LENGTH}
          isLoading={handover.isPending}
          size="large"
        />
        <View style={styles.refund}>
          <Text style={styles.refundText}>{t("handover.cantHandOver")}</Text>
          <Pressable
            onPress={onRefund}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.refundLink}>
              {t("handover.refund", { name: buyer })}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    );
  },
);

/** What the buyer reported: reason, note, photos. */
function DisputeSummary({
  dispute,
  buyer,
}: {
  dispute: Dispute;
  buyer: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.dispute}>
      <View style={styles.disputeHead}>
        <CircleAlert size={18} color={colors.warningText} strokeWidth={2} />
        <Text style={styles.disputeTitle}>
          {t("handover.reportBy", {
            name: buyer,
            reason: t(`report.reasonLabel_${dispute.reason}`),
          })}
        </Text>
      </View>
      {dispute.note ? (
        <Text style={styles.disputeNote}>« {dispute.note} »</Text>
      ) : null}
      {dispute.photoPaths.length > 0 ? (
        <View style={styles.photos}>
          {dispute.photoPaths.map((path, index) => (
            <Image
              key={path}
              source={imageUrl(path, PHOTO_SIZE * 3)}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel={t("handover.photo", { index: index + 1 })}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function codeErrorMessage(error: unknown, buyer: string) {
  if (error instanceof ApiRequestError) {
    if (error.code === "handover_code_invalid") {
      return i18n.t("errors.handoverCode", { name: buyer });
    }
    if (error.code === "rate_limited") return i18n.t("errors.tooManyCodes");
  }
  return dealErrorMessage(error);
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  input: {
    height: 68,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: "transparent",
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 18,
    // The spacing follows each digit, the last one too: centered again
    paddingLeft: 18,
    color: colors.black,
    fontVariant: ["tabular-nums"],
    backgroundColor: colors.track,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    textAlign: "center",
  },
  refund: {
    alignItems: "center",
    gap: 2,
  },
  refundText: {
    fontSize: 13,
    color: colors.muted,
  },
  refundLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  dispute: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.warning,
  },
  disputeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  disputeTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.warningText,
  },
  disputeNote: {
    fontSize: 14,
    color: colors.warningText,
  },
  photos: {
    flexDirection: "row",
    gap: 8,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
});
