import type { Conversation } from "@dily/shared";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { Sheet, type SheetRef } from "@/components/sheet";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { dealErrorMessage, firstName } from "@/lib/offers";
import { useConfirmReceipt, useOrderDetails } from "@/services/orders.service";
import { colors } from "@/theme/colors";

import { HandoverCodeDigits } from "./handover-code";

export type HandoverCodeSheetRef = { open: () => void };

type Props = {
  conversation: Conversation;
  orderId: string;
  /** "Signaler un problème": this sheet gives way to the report one. */
  onReport: () => void;
};

/**
 * The buyer's handover code, to give once they have the item and checked
 * it; or "J'ai reçu l'article", or a problem to report.
 */
export const HandoverCodeSheet = forwardRef<HandoverCodeSheetRef, Props>(
  function HandoverCodeSheet({ conversation, orderId, onReport }, ref) {
    const { t } = useTranslation();
    const { notification } = useHaptics();
    const sheet = useRef<SheetRef>(null);
    const { data } = useOrderDetails(orderId);
    const confirm = useConfirmReceipt();
    const seller = firstName(conversation.otherUser.name);
    const order = data?.order ?? conversation.deal.order;
    const disputed = order?.status === "disputed";

    useImperativeHandle(ref, () => ({
      open: () => {
        confirm.reset();
        sheet.current?.present();
      },
    }));

    const onReceived = () =>
      Alert.alert(
        t("handover.receivedTitle"),
        t("handover.receivedBody", { name: seller }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("handover.confirm"),
            onPress: () =>
              confirm.mutate(orderId, {
                onSuccess: () => {
                  notification("success");
                  sheet.current?.dismiss();
                },
                onError: (error) => {
                  notification("error");
                  Alert.alert(dealErrorMessage(error));
                },
              }),
          },
        ],
      );

    return (
      <Sheet
        ref={sheet}
        title={t("handover.codeTitle")}
        subtitle={
          order?.fulfilment === "delivery"
            ? t("handover.codeForCourier")
            : t("handover.codeForSeller", { name: seller })
        }
        dismissible={!confirm.isPending}
        footer={
          <>
            {disputed ? null : (
              <ActionButton
                label={t("handover.report")}
                variant="quiet"
                onPress={onReport}
                style={styles.flex}
              />
            )}
            <ActionButton
              label={t("handover.received")}
              onPress={onReceived}
              isLoading={confirm.isPending}
              style={styles.flex}
            />
          </>
        }
      >
        <View style={styles.code}>
          {data?.handoverCode ? (
            <HandoverCodeDigits code={data.handoverCode} />
          ) : (
            <Spinner color={colors.primary} size={28} />
          )}
        </View>
        <View style={[styles.note, disputed && styles.noteDisputed]}>
          <Lock size={16} color={colors.warningText} strokeWidth={2} />
          <Text style={styles.noteText}>
            {disputed ? t("handover.disputed") : t("handover.neverEarly")}
          </Text>
        </View>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  code: {
    minHeight: 68,
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.warning,
  },
  noteDisputed: {
    alignItems: "center",
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.warningText,
  },
});
