import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
} from "@gorhom/bottom-sheet";
import {
  type ComponentRef,
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme/colors";

export type SheetRef = BottomSheetModal;

type SheetProps = {
  /** Also the sheet's label for screen readers. */
  title: string;
  /** Line under the title: "Mamadou demande 18 700 F livré". */
  subtitle?: string;
  /** Gone from the screen, however it was closed. */
  onDismiss?: () => void;
  children?: ReactNode;
  /** Buttons at the end of the sheet, above the keyboard when it's open. */
  footer?: ReactNode;
  /** False while sending: no drag, no scrim tap, no close button. */
  dismissible?: boolean;
};

/** Room left above the sheet when it takes all the height. */
const TOP_GAP = 12;
const GAP = 18;
/** On the keyboard, as in the design's "Autre" screen. */
const KEYBOARD_GAP = 14;
/** The design leaves 40 pt under the buttons, home indicator included. */
const BOTTOM_SPACE = 40;
const TITLE_LINE = 28;
const CLOSE_SIZE = 40;

/**
 * Bottom sheet as in payme-business (`@gorhom/bottom-sheet`): slides up
 * with a spring, as tall as its content, follows the finger and closes when
 * dragged down, on the scrim or with its button. The design's look: handle,
 * title, close button, 28 pt corners. Open it with `ref.present()`.
 *
 * The whole sheet moves as one, buttons included. With the keyboard open it
 * sits on it and stops under the status bar, its content scrolled down to
 * the fields and buttons. Everything moves on the UI thread.
 */
export const Sheet = forwardRef<SheetRef, SheetProps>(function Sheet(
  { title, subtitle, onDismiss, children, footer, dismissible = true },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { dismiss } = useBottomSheetModal();
  const { t } = useTranslation();
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  const gap = keyboardOpen ? KEYBOARD_GAP : GAP;
  // Keyboard closed: BOTTOM_SPACE under the buttons; open: GAP above it
  const bottomSpace = keyboardOpen
    ? GAP
    : Math.max(BOTTOM_SPACE, insets.bottom + 6);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior={dismissible ? "close" : "none"}
      />
    ),
    [dismissible],
  );

  // The handle area is what the finger drags: handle, title, close button
  const renderHandle = useCallback(
    () => (
      <View style={styles.handleArea}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={() => dismiss()}
            disabled={!dismissible}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={({ pressed }) => [
              styles.close,
              (pressed || !dismissible) && styles.pressed,
            ]}
          >
            <X size={18} color={colors.black} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    ),
    [title, subtitle, dismissible, dismiss, t],
  );

  // Keyboard open: down to the bottom, where the fields and buttons are
  const scroll = useRef<ComponentRef<typeof BottomSheetScrollView>>(null);
  useEffect(() => {
    if (!keyboardOpen) return;
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [keyboardOpen]);

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      enableDynamicSizing
      maxDynamicContentSize={height - insets.top - TOP_GAP}
      topInset={insets.top + TOP_GAP}
      enablePanDownToClose={dismissible}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      backgroundStyle={styles.background}
      accessibilityLabel={title}
    >
      <BottomSheetScrollView
        ref={scroll}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.body,
          { gap, paddingTop: gap, paddingBottom: bottomSpace },
        ]}
      >
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  handleArea: {
    paddingTop: 10,
    paddingHorizontal: 22,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  header: {
    flexDirection: "row",
    // The close button on the title's line, not the subtitle's
    alignItems: "flex-start",
    gap: 12,
    marginTop: GAP,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: TITLE_LINE,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: colors.black,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    // Centered on the title's line
    marginTop: (TITLE_LINE - CLOSE_SIZE) / 2,
    borderRadius: 13,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.track,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    paddingHorizontal: 22,
  },
  footer: {
    flexDirection: "row",
    gap: 8,
  },
});
