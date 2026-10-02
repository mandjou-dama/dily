import { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useIsFocused } from "@react-navigation/native";
import type { FeedProduct } from "@/services/products.service";
import { imageUrl } from "@/lib/image";
import { formatPrice } from "@/lib/format";
import { colors } from "@/theme/colors";

// Time each pick stays on screen before auto-advancing
const PICK_DURATION_MS = 5000;

// Every height is fixed so the collapsible header is measured once and never
// re-laid out when the pick changes.
const IMAGE_HEIGHT = 260;
// The photo sits in a taped print, like the onboarding photos
const FRAME_WIDTH = 196;
const FRAME_HEIGHT = 236;
// Frame is ~200pt wide: 2x density
const PICK_IMAGE_WIDTH = 480;
export const SPOTLIGHT_HEADER_HEIGHT = 360;

type Props = {
  // Empty while loading: the header keeps its height so the list doesn't jump
  picks: FeedProduct[];
  onPressPick: (pickId: string) => void;
};

export const SpotlightHeader = memo(function SpotlightHeader({
  picks,
  onPressPick,
}: Props) {
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const isFocused = useIsFocused();
  // With reduced motion, picks stop auto-advancing (the bars stay tappable)
  const reduceMotion = useReducedMotion();

  // Picks can shrink on refetch: never index past the end
  const pick = picks.length > 0 ? picks[index % picks.length] : undefined;

  useEffect(() => {
    const goToNextPick = () => setIndex((i) => (i + 1) % picks.length);

    progress.set(0);
    if (!isFocused || reduceMotion) return;

    // The timer lives on the UI thread: the bar fill and the advance stay in
    // sync and the JS thread is only touched once per pick.
    progress.set(
      withTiming(
        1,
        { duration: PICK_DURATION_MS, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(goToNextPick);
        },
      ),
    );

    return () => cancelAnimation(progress);
  }, [index, isFocused, reduceMotion, picks.length, progress]);

  if (!pick) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{"Today's Pick"}</Text>
        <View style={styles.imageWrapper}>
          <View style={[styles.frame, styles.framePlaceholder]} />
        </View>
      </View>
    );
  }

  const price = formatPrice(pick.price);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{"Today's Pick"}</Text>

      {/* The fade lives on a wrapper so it doesn't fight the text's opacity */}
      <Animated.View key={pick.id} entering={FadeIn.duration(250)}>
        <Text numberOfLines={1} style={styles.subtitle}>
          {pick.title},{" "}
          <Text style={styles.subtitleHighlight}>{price} F CFA</Text>
        </Text>
      </Animated.View>

      <Pressable
        onPress={() => onPressPick(pick.id)}
        accessibilityRole="button"
        accessibilityLabel={`${pick.title}, ${price} F CFA, sold by ${pick.sellerName}`}
        style={styles.imageWrapper}
      >
        <View style={styles.frame}>
          <Image
            source={imageUrl(
              "product-images",
              pick.imagePath,
              PICK_IMAGE_WIDTH,
            )}
            contentFit="cover"
            cachePolicy="memory-disk"
            // Native cross-dissolve between picks, no JS animation involved
            transition={{ duration: 300, effect: "cross-dissolve" }}
            style={styles.image}
          />
          <View style={[styles.tape, styles.tapeTopLeft]} />
          <View style={[styles.tape, styles.tapeBottomRight]} />
        </View>
      </Pressable>

      <View style={styles.bars}>
        {picks.map((p, i) => (
          <ProgressBar
            key={p.id}
            active={i === index}
            progress={progress}
            label={`Show pick ${i + 1} of ${picks.length}`}
            onPress={() => setIndex(i)}
          />
        ))}
      </View>
    </View>
  );
});

type ProgressBarProps = {
  active: boolean;
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
};

const ProgressBar = memo(function ProgressBar({
  active,
  progress,
  label,
  onPress,
}: ProgressBarProps) {
  // Only transform is animated: no layout pass per frame
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 16, bottom: 16 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.bar, active && styles.barActive]}
    >
      {active && <Animated.View style={[styles.barFill, fillStyle]} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    height: SPOTLIGHT_HEADER_HEIGHT,
    paddingTop: 12,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.primary,
  },
  subtitle: {
    marginTop: 2,
    paddingHorizontal: 30,
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    opacity: 0.75,
  },
  subtitleHighlight: {
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  imageWrapper: {
    width: "100%",
    height: IMAGE_HEIGHT,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    padding: 7,
    backgroundColor: colors.white,
    transform: [{ rotate: "-2deg" }],
  },
  framePlaceholder: {
    backgroundColor: "#EAE7DC",
  },
  image: {
    flex: 1,
    backgroundColor: "#EAE7DC",
  },
  tape: {
    position: "absolute",
    width: 74,
    height: 22,
    backgroundColor: "rgba(60, 86, 39, 0.82)",
    transform: [{ rotate: "-35deg" }],
  },
  tapeTopLeft: {
    top: -4,
    left: -22,
  },
  tapeBottomRight: {
    bottom: 2,
    right: -24,
  },
  bars: {
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    width: 200,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#CFD3C0",
    overflow: "hidden",
  },
  barActive: {
    flex: 3,
  },
  barFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    transformOrigin: "left",
  },
});
