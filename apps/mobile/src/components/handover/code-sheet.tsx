import type { Conversation } from "@dily/shared";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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
 * it: the one way to finish. A problem can be reported instead; when the
 * seller can't type the code, a small link lets the buyer confirm.
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
      >
        <CodeNotice code={data?.handoverCode ?? null}>
          {disputed ? t("handover.disputed") : t("handover.neverEarly")}
        </CodeNotice>
        {disputed ? null : (
          <ActionButton
            label={t("handover.report")}
            variant="quiet"
            onPress={onReport}
            disabled={confirm.isPending}
          />
        )}
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            {t("handover.receivedHint", { name: seller })}
          </Text>
          <Pressable
            onPress={onReceived}
            disabled={confirm.isPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ busy: confirm.isPending }}
            style={({ pressed }) => [
              styles.fallbackLink,
              (pressed || confirm.isPending) && styles.pressed,
            ]}
          >
            {confirm.isPending ? (
              <Spinner color={colors.primary} size={14} />
            ) : null}
            <Text style={styles.fallbackLinkText}>
              {t("handover.receivedLink")}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    );
  },
);

/** Where the tab meets the band: a concave curve on each side. */
const JOIN = 14;

/**
 * The code and its warning as one shape: the digits sit in a tab that
 * rises from the warning band.
 */
function CodeNotice({
  code,
  children,
}: {
  code: string | null;
  children: string;
}) {
  return (
    <View style={styles.notice}>
      <View style={styles.tab}>
        {code ? (
          <HandoverCodeDigits code={code} onTint />
        ) : (
          <View style={styles.loading}>
            <Spinner color={colors.primary} size={28} />
          </View>
        )}
        <View style={[styles.join, styles.joinLeft]}>
          <View style={[styles.joinCut, styles.joinCutLeft]} />
        </View>
        <View style={[styles.join, styles.joinRight]}>
          <View style={[styles.joinCut, styles.joinCutRight]} />
        </View>
      </View>
      <View style={styles.band}>
        <Text style={styles.bandText}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "center",
  },
  tab: {
    padding: 8,
    // The digit boxes' 16 pt corners plus the padding: concentric
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: "continuous",
    backgroundColor: colors.warning,
  },
  loading: {
    width: 262,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  // A square of the band's color, its outer corner cut by a quarter circle
  // of the sheet's: the band curves up into the tab
  join: {
    position: "absolute",
    bottom: 0,
    width: JOIN,
    height: JOIN,
    backgroundColor: colors.warning,
  },
  joinLeft: {
    left: -JOIN,
  },
  joinRight: {
    right: -JOIN,
  },
  joinCut: {
    flex: 1,
    backgroundColor: colors.white,
  },
  joinCutLeft: {
    borderBottomRightRadius: JOIN,
  },
  joinCutRight: {
    borderBottomLeftRadius: JOIN,
  },
  band: {
    alignSelf: "stretch",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.warning,
  },
  bandText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.warningText,
    textAlign: "center",
  },
  fallback: {
    alignItems: "center",
    gap: 2,
  },
  fallbackText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  fallbackLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fallbackLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.6,
  },
});
