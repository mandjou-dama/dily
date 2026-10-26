import {
  type DisputeReason,
  disputeReasons,
  DISPUTE_NOTE_MAX_LENGTH,
  DISPUTE_PHOTOS_MAX,
} from "@dily/shared";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Camera, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { Sheet, type SheetRef } from "@/components/sheet";
import { useHaptics } from "@/hooks/use-haptics";
import { useImagePicker } from "@/hooks/use-image-picker";
import { dealErrorMessage } from "@/lib/offers";
import { type ReportPhoto, useReportProblem } from "@/services/orders.service";
import { colors } from "@/theme/colors";

export type ReportSheetRef = { open: () => void };

const PHOTO_SIZE = 72;

/**
 * "Signaler un problème": what's wrong, a few words, photos (required when
 * the item isn't what the listing showed). Dily keeps the money meanwhile.
 */
export const ReportSheet = forwardRef<ReportSheetRef, { orderId: string }>(
  function ReportSheet({ orderId }, ref) {
    const { t } = useTranslation();
    const { selection, notification } = useHaptics();
    const sheet = useRef<SheetRef>(null);
    const { pickImages, isPicking } = useImagePicker();
    const report = useReportProblem();
    const [reason, setReason] = useState<DisputeReason | null>(null);
    const [note, setNote] = useState("");
    const [photos, setPhotos] = useState<ReportPhoto[]>([]);
    const [tried, setTried] = useState(false);
    const needsPhoto = reason === "not_as_described" && photos.length === 0;

    useImperativeHandle(ref, () => ({
      open: () => {
        setReason(null);
        setNote("");
        setPhotos([]);
        setTried(false);
        report.reset();
        sheet.current?.present();
      },
    }));

    const addPhotos = async () => {
      const picked = await pickImages({
        limit: DISPUTE_PHOTOS_MAX - photos.length,
        allowsEditing: false,
      });
      if (!picked) return;
      setPhotos((current) =>
        [
          ...current,
          ...picked.map(({ uri, width, height }) => ({ uri, width, height })),
        ].slice(0, DISPUTE_PHOTOS_MAX),
      );
    };

    const onSend = () => {
      setTried(true);
      if (!reason || needsPhoto || report.isPending) return;
      report.mutate(
        { orderId, reason, note: note.trim(), photos },
        {
          onSuccess: () => {
            notification("success");
            sheet.current?.dismiss();
          },
          onError: (error) => {
            notification("error");
            Alert.alert(dealErrorMessage(error));
          },
        },
      );
    };

    return (
      <Sheet
        ref={sheet}
        title={t("report.title")}
        subtitle={t("report.subtitle")}
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
              label={t("report.send")}
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
          accessibilityLabel={t("report.reason")}
        >
          {disputeReasons.map((value) => {
            const selected = reason === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  if (!selected) selection();
                  setReason(value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.reason, selected && styles.reasonSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.reasonText}>{t(`report.${value}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t("report.note")}</Text>
          <BottomSheetTextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("report.notePlaceholder")}
            placeholderTextColor={colors.muted}
            maxLength={DISPUTE_NOTE_MAX_LENGTH}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t("report.note")}
            style={styles.note}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t("report.photos")}</Text>
          <View style={styles.photos}>
            {photos.map((photo, index) => (
              <View key={photo.uri} style={styles.photo}>
                <Image
                  source={photo.uri}
                  style={styles.photoImage}
                  contentFit="cover"
                />
                <Pressable
                  onPress={() =>
                    setPhotos((current) =>
                      current.filter((p) => p.uri !== photo.uri),
                    )
                  }
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t("report.removePhoto", {
                    index: index + 1,
                  })}
                  style={styles.remove}
                >
                  <X size={12} color={colors.white} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
            {photos.length < DISPUTE_PHOTOS_MAX ? (
              <Pressable
                onPress={addPhotos}
                disabled={isPicking}
                accessibilityRole="button"
                accessibilityLabel={t("report.addPhoto")}
                style={({ pressed }) => [
                  styles.photo,
                  styles.add,
                  pressed && styles.pressed,
                ]}
              >
                <Camera size={22} color={colors.primary} strokeWidth={1.8} />
              </Pressable>
            ) : null}
          </View>
          {needsPhoto ? (
            <Text style={[styles.hint, tried && styles.hintError]}>
              {t("report.photosRequired")}
            </Text>
          ) : null}
        </View>
      </Sheet>
    );
  },
);

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
  reason: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  reasonSelected: {
    borderColor: colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
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
  photos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.track,
  },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scrim,
  },
  add: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.outline,
  },
  pressed: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 13,
    color: colors.muted,
  },
  hintError: {
    color: colors.danger,
  },
});
