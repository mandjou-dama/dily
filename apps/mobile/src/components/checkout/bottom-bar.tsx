import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

/** Between the button and the keyboard, when the bar rides on it. */
const KEYBOARD_GAP = 12;
/**
 * Under the field being typed in, down to the keyboard: the bar riding on
 * it, and some air.
 */
export const STICKY_BAR_ROOM = 12 + 48 + KEYBOARD_GAP + 28;

/**
 * The screen's main buttons, above the home indicator. `sticky`: on the
 * keyboard while it's open, moved on the UI thread.
 */
export function BottomBar({
  children,
  roomy = false,
  sticky = false,
}: {
  children: ReactNode;
  /** 16 pt above instead of 12, as on the waiting and paid screens. */
  roomy?: boolean;
  sticky?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom, 16);
  const bar = (
    <View style={[styles.bar, roomy && styles.roomy, { paddingBottom }]}>
      {children}
    </View>
  );
  if (!sticky) return bar;
  return (
    <KeyboardStickyView
      // On the keyboard, the home indicator's room isn't needed
      offset={{ closed: 0, opened: paddingBottom - KEYBOARD_GAP }}
      style={styles.sticky}
    >
      {bar}
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  roomy: {
    paddingTop: 16,
  },
  sticky: {
    // Covers what scrolls under it while it rides on the keyboard
    backgroundColor: colors.background,
  },
});
