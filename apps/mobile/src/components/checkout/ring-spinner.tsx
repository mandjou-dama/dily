import { memo } from "react";
import Animated from "react-native-reanimated";

import { colors } from "@/theme/colors";

type Props = {
  size: number;
  thickness: number;
  /** The ring; its top quarter turns in `color`. */
  track: string;
  color?: string;
};

// A Reanimated CSS animation: turns on the UI thread, nothing re-renders
const TURN = { to: { transform: [{ rotate: "360deg" }] } };

/** Waiting ring: a light circle whose top turns, as in the design. */
function RingSpinnerBase({
  size,
  thickness,
  track,
  color = colors.primary,
}: Props) {
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: track,
        borderTopColor: color,
        animationName: TURN,
        animationDuration: "900ms",
        animationIterationCount: "infinite",
        animationTimingFunction: "linear",
      }}
    />
  );
}

export const RingSpinner = memo(RingSpinnerBase);
