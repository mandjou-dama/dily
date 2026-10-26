import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useHaptics } from "@/hooks/use-haptics";
import { colors } from "@/theme/colors";

export type Segment<T extends string> = {
  value: T;
  title: string;
  subtitle?: string;
  /** Icon or logo before the text; gets the selected state to pick its color. */
  leading?: (selected: boolean) => ReactNode;
};

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What is being chosen, for screen readers. */
  accessibilityLabel: string;
  /** The track's color depends on what it sits on. */
  surface?: "white" | "background";
};

/**
 * Two or three side-by-side choices (pickup or delivery, Orange Money or
 * Moov Money): the selected one is a white card with a green border. The
 * change is instant: nothing to animate, nothing to lay out again.
 */
function SegmentedControlBase<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  surface = "white",
}: Props<T>) {
  const { selection } = useHaptics();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        surface === "background" && styles.trackOnBackground,
      ]}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => {
              if (selected) return;
              selection();
              onChange(segment.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {segment.leading?.(selected)}
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>
                {segment.title}
              </Text>
              {segment.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {segment.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export const SegmentedControl = memo(
  SegmentedControlBase,
) as typeof SegmentedControlBase;

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.track,
  },
  trackOnBackground: {
    backgroundColor: colors.trackOnBackground,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  segmentSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
});
