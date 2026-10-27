import {
  listingReportReasons,
  REPORT_NOTE_MAX_LENGTH,
  type ReportBody,
  type ReportReason,
  userReportReasons,
} from "@dily/shared";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { useNotify } from "@/components/notify";
import { RadioOption } from "@/components/radio-option";
import { Sheet, type SheetRef } from "@/components/sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { dealErrorMessage } from "@/lib/offers";
import { useReport } from "@/services/moderation.service";
import { colors } from "@/theme/colors";

export type ModerationReportSheetRef = { open: () => void };

/** What's reported: a listing, or the other person of a conversation. */
export type ReportTarget =
  | { kind: "listing"; productId: string }
  | { kind: "user"; conversationId: string };

type Props = {
  target: ReportTarget;
  /** The seller, or the other person: "Signaler Mamadou". */
  name: string;
};

/**
 * "Signaler": why, and a few words if they want. Dily reviews it within
 * 24 hours; the person reported isn't told who it was.
 */
export const ModerationReportSheet = forwardRef<
  ModerationReportSheetRef,
  Props
>(function ModerationReportSheet({ target, name }, ref) {
  const { t } = useTranslation();
  const { notify } = useNotify();
  const { selection, notification } = useHaptics();
  const sheet = useRef<SheetRef>(null);
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const reasons =
    target.kind === "listing" ? listingReportReasons : userReportReasons;

  useImperativeHandle(ref, () => ({
    open: () => {
      setReason(null);
      setNote("");
      report.reset();
      sheet.current?.present();
    },
  }));

  const onSend = () => {
    if (!reason || report.isPending) return;
    // The reasons listed are the target's own
    const body = { ...target, reason, note: note.trim() } as ReportBody;
    report.mutate(body, {
      onSuccess: () => {
        notification("success");
        sheet.current?.dismiss();
        notify(t("moderation.sent"));
      },
      onError: (error) => {
        notification("error");
        Alert.alert(dealErrorMessage(error));
      },
    });
  };

  return (
    <Sheet
      ref={sheet}
      title={
        target.kind === "listing"
          ? t("moderation.reportListing")
          : t("moderation.reportUser", { name })
      }
      subtitle={
        target.kind === "listing"
          ? t("moderation.listingSubtitle", { name })
          : t("moderation.userSubtitle", { name })
      }
      dismissible={!report.isPending}
      footer={
        <>
          <ActionButton
            label={t("common.cancel")}
            variant="outline"
            onPress={() => sheet.current?.dismiss()}
            disabled={report.isPending}
            style={styles.flex}
          />
          <ActionButton
            label={t("moderation.send")}
            onPress={onSend}
            disabled={!reason}
            isLoading={report.isPending}
            style={styles.flex}
          />
        </>
      }
    >
      <View
        style={styles.section}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("moderation.reason")}
      >
        {reasons.map((value) => (
          <RadioOption
            key={value}
            label={t(`moderation.reason_${value}`)}
            selected={reason === value}
            onPress={() => {
              if (reason !== value) selection();
              setReason(value);
            }}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t("moderation.note")}</Text>
        <BottomSheetTextInput
          value={note}
          onChangeText={setNote}
          placeholder={t("moderation.notePlaceholder")}
          placeholderTextColor={colors.muted}
          maxLength={REPORT_NOTE_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t("moderation.note")}
          style={styles.note}
        />
      </View>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  note: {
    minHeight: 84,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.track,
  },
});
