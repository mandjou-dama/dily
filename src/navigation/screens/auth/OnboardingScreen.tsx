import { Phone, UserRound } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingSlide } from "@/lib/types";
import { simulatePress } from "@/lib/simulate-press";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Carousel from "@/components/onboarding/onboarding-carousel";
import AntDesign from "@expo/vector-icons/AntDesign";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@/types/navigation";
import { useHaptics } from "@/hooks/use-haptics";
import OnboardingActions from "@/components/onboarding/onboarding-actions";

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

export const SLIDES: OnboardingSlide[] = [
  {
    bgColor: colors.white,
    duration: 4000,
    title: "Snap & Sell in Seconds",
    subtitle:
      "Just take a photo. **We handle the rest**. List items in under 30 seconds.",
    image: require("assets/onboarding_2.png"),
  },
  {
    bgColor: colors.white,
    duration: 4000,
    title: "Find Local Treasures",
    subtitle:
      "Discover unique items from sellers in your neighborhood. **No shipping required!**",
    image: require("assets/onboarding_1.png"),
  },
  {
    bgColor: colors.white,
    duration: 4000,
    title: "Safe & Secure Trading",
    subtitle:
      "Built-in messaging and secure payment. Trade with **complete peace of mind**.",
    image: require("assets/onboarding_5.png"),
  },
  {
    bgColor: colors.white,
    duration: 4000,
    title: "Join Dily !",
    subtitle:
      "Join **Mali's fastest-growing** local marketplace and discover a new way to buy and sell.",
    image: require("assets/onboarding_3.png"),
  },
];

// Distance in pixels to translate carousel upward when fully expanded
// Reveals sign-in buttons below carousel
const TOP_CAROUSEL_OFFSET = 230;
// Minimum swipe distance (in pixels) to trigger expand/collapse transition
// Prevents accidental toggles from small finger movements
const SWIPE_UP_THRESHOLD = 20;

export const OnboardingScreen = ({ navigation }: Props) => {
  const { impact } = useHaptics();

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const horizontalListRef = useRef<FlatList<OnboardingSlide>>(null);

  // Continuous slide index (0.0, 0.5, 1.0, 1.5...) derived from scrollOffsetX / screenWidth
  // Enables smooth pagination width interpolation between discrete slide indices
  const animatedSlideIndex = useSharedValue(0);
  // Horizontal scroll offset in pixels, drives slide card animations (rotate/translateY)
  // Updated via scrollHandler on every scroll event (throttled to 16ms)
  const scrollOffsetX = useSharedValue(0);
  // Prevents auto-advance and progress animations during user interaction
  // Set to true on drag start, false on drag end
  const isDragging = useSharedValue(false);
  // Vertical translation for swipe-up gesture: 0 = collapsed, -TOP_CAROUSEL_OFFSET = expanded
  // Negative values move carousel upward, revealing content below
  const translateY = useSharedValue(0);
  // Stores translateY value at gesture start, used to calculate relative movement
  // Critical for pan gesture: accumulates translation from gesture start, not absolute position
  const gestureStartY = useSharedValue(0);

  // Scroll handler: updates shared values for scroll-driven animations
  // Runs on UI thread (worklet), enabling 60fps animations without JS bridge overhead
  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      // Disable auto-advance when user starts dragging
      isDragging.set(true);
    },
    onScroll: (event) => {
      const offsetX = event.contentOffset.x;
      // Update scroll position for slide card animations (rotate/translateY)
      scrollOffsetX.set(offsetX);
      // Calculate continuous slide index for smooth pagination width interpolation
      // Example: offsetX = 150px, screenWidth = 375px → animatedSlideIndex = 0.4
      animatedSlideIndex.set(offsetX / screenWidth);
    },
    onEndDrag: () => {
      // Re-enable auto-advance and resume progress animations
      isDragging.set(false);
    },
  });

  const handleScrollToIndex = useCallback((index: number) => {
    horizontalListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  }, []);

  // Single tap gesture: advances to next slide when carousel is collapsed
  // maxDuration: 250ms ensures quick taps register, longer presses ignored
  const singleTap = Gesture.Tap()
    // .maxDuration(40000)
    .maxDuration(250)
    .onStart(() => {
      // Only advance if carousel is fully collapsed (translateY >= 0)
      if (translateY.get() < 0) return;
      scheduleOnRN(handleScrollToIndex, currentSlideIndex + 1);
      isDragging.set(false);
    });

  // Pan gesture: handles vertical swipe-up/down to expand/collapse carousel
  // Uses damping factor (÷4) for smoother, more controlled feel
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      isDragging.set(true);
      // Store starting position to calculate relative movement
      // Critical: gestureStartY captures translateY at gesture start, not absolute 0
      gestureStartY.set(translateY.get());
    })
    .onUpdate((e) => {
      // Prevent overscroll: block upward swipe when already at max expansion
      if (translateY.get() <= -TOP_CAROUSEL_OFFSET && e.translationY < 0) {
        return;
      }

      // Calculate new position: start position + gesture delta with damping
      // Damping factor (÷4): reduces sensitivity, creates smoother drag feel
      // e.translationY: positive = swipe down, negative = swipe up
      const proposed = gestureStartY.get() + e.translationY / 4;
      // Clamp between bounds: 0 (collapsed) to -TOP_CAROUSEL_OFFSET (expanded)
      const clamped = Math.min(0, Math.max(proposed, -TOP_CAROUSEL_OFFSET));
      translateY.set(clamped);
    })
    .onEnd((e) => {
      const currentY = translateY.get();

      // Determine if carousel is currently expanded (negative translateY)
      const isExpanded = currentY < 0;

      // Check if user swiped up enough to trigger transition
      // Compares absolute values: if moved up by threshold, expand
      const isTopThresholdReached =
        Math.abs(gestureStartY.get()) - Math.abs(currentY) > SWIPE_UP_THRESHOLD;

      // Check if user swiped down enough to trigger collapse
      const isBottomThresholdReached =
        Math.abs(currentY) - Math.abs(gestureStartY.get()) > SWIPE_UP_THRESHOLD;

      // Determine target position based on swipe direction and threshold
      // If swiped up past threshold: expand (go to 0 or stay at -TOP_CAROUSEL_OFFSET)
      const expandedPositionMap = isTopThresholdReached
        ? 0
        : -TOP_CAROUSEL_OFFSET;
      // If swiped down past threshold: collapse (go to -TOP_CAROUSEL_OFFSET or stay at 0)
      const collapsedPositionMap = isBottomThresholdReached
        ? -TOP_CAROUSEL_OFFSET
        : 0;

      const target = isExpanded ? expandedPositionMap : collapsedPositionMap;

      // Animate to target with spring physics for natural feel
      translateY.set(
        withSpring(target, {}, (finished) => {
          // Re-enable interactions only when fully collapsed
          if (finished && target === 0) {
            isDragging.set(false);
          }
        })
      );
    });

  const expandCarousel = () => {
    if (translateY.get() <= -TOP_CAROUSEL_OFFSET) {
      navigation.navigate("WhatsAppLogin");
    } else {
      // Immédiatement arrêter tout défilement
      isDragging.set(true);

      // Utiliser la MÊME animation que dans PaginationItem
      translateY.set(
        withTiming(
          -TOP_CAROUSEL_OFFSET,
          {
            duration: 200,
            easing: Easing.inOut(Easing.quad),
          },
          (finished) => {
            if (finished) {
              isDragging.set(true); // Garder disabled pour éviter auto-advance
            }
          }
        )
      );
    }

    impact("light");
  };

  // Fade in sign-in buttons block as carousel expands upward
  // Input: translateY from 0 (collapsed) to -TOP_CAROUSEL_OFFSET (expanded)
  // Output: opacity from 0 (hidden) to 1 (visible)
  const rButtonsBlockStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateY.get(),
        [0, -TOP_CAROUSEL_OFFSET],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  // "Sign Up / Sign In" button: slides up 40px as carousel expands
  // Creates staggered reveal effect with "Continue with email" button
  const rSignUpStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            translateY.get(),
            [0, -TOP_CAROUSEL_OFFSET],
            [0, -40],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // "Continue with email" button: slides down from 40px offset to 0 as carousel expands
  // Starts below final position, creating upward slide-in animation
  const rContinueWithEmailStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            translateY.get(),
            [0, -TOP_CAROUSEL_OFFSET],
            [40, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // Gradient overlay: fades in as carousel expands to add depth/darkening effect
  // Helps separate carousel from sign-in buttons below
  const rGradientStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateY.get(),
        [0, -TOP_CAROUSEL_OFFSET],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  // Collapse carousel when user taps chevron down button
  // Smoothly animates translateY back to 0 (collapsed position)
  const slideBottomHandler = () => {
    isDragging.set(false);
    translateY.set(
      withTiming(0, {
        duration: 300,
      })
    );
  };

  return (
    <View
      // className="flex-1 bg-slate-900"
      style={{
        paddingBottom: insets.bottom + 10,
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <OnboardingActions
        rButtonsBlockStyle={rButtonsBlockStyle}
        onGooglePress={simulatePress}
        onApplePress={simulatePress}
      />

      {/* <Animated.View style={[rButtonsBlockStyle, { marginTop: "auto" }]}>
        <Text
          style={{
            color: colors.black,
            textAlign: "center",
            fontSize: 32,
            fontWeight: "bold",
          }}
        >
          Buy. Sell. Connect.
        </Text>

        <Text
          style={{
            color: colors.black,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          A simple way to trade items
        </Text>

        <Text
          style={{
            color: colors.black,
            textAlign: "center",
          }}
        >
          with people near you.
        </Text>
        <Pressable
          onPress={simulatePress}
          style={{
            borderCurve: "continuous",
            flexDirection: "row",
            height: 45,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 13,
            marginHorizontal: 80,
            marginTop: 32,
            backgroundColor: colors.white,
          }}
        >
          <AntDesign name="google" size={24} color={colors.black} />
          <Text style={{ color: colors.black }}>Continue with Google</Text>
        </Pressable>
        <Pressable
          onPress={simulatePress}
          style={{
            borderCurve: "continuous",
            flexDirection: "row",
            height: 45,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 13,
            marginHorizontal: 80,
            marginTop: 12,
            backgroundColor: colors.black,
          }}
        >
          <AntDesign name="apple" size={24} color={colors.white} />
          <Text style={{ color: colors.white }}>Continue with Apple</Text>
        </Pressable>
      </Animated.View> */}

      <Pressable
        onPress={() => expandCarousel()}
        style={{
          borderCurve: "continuous",
          height: 45,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 13,
          marginHorizontal: 80,
          marginTop: 12,
          backgroundColor: colors.primary,
          overflow: "hidden",
        }}
      >
        <Animated.View
          //   className="flex-row gap-2 pt-0"
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingTop: 0,
            },
            rSignUpStyle,
          ]}
        >
          <UserRound size={16} color={colors.white} />
          <Text style={{ color: colors.white }}>Sign Up / Sign In</Text>
        </Animated.View>
        <Animated.View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: -16,
            },
            rContinueWithEmailStyle,
          ]}
        >
          <Phone size={16} color={colors.white} />
          <Text
            style={{
              color: colors.white,
            }}
          >
            Continue with Phone
          </Text>
        </Animated.View>
      </Pressable>

      <GestureDetector gesture={Gesture.Race(panGesture, singleTap)}>
        <Carousel
          SLIDES={SLIDES}
          currentSlideIndex={currentSlideIndex}
          setCurrentSlideIndex={setCurrentSlideIndex}
          animatedSlideIndex={animatedSlideIndex}
          horizontalListRef={horizontalListRef}
          scrollHandler={scrollHandler}
          translateY={translateY}
          scrollOffsetX={scrollOffsetX}
          isDragging={isDragging}
          topCarouselOffset={TOP_CAROUSEL_OFFSET}
        />
      </GestureDetector>

      <Animated.View
        style={[
          rGradientStyle,
          {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            pointerEvents: "none",
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(60, 86, 39,0.4)", "transparent"]}
          style={{ width: "100%", height: "30%" }}
        />
      </Animated.View>
    </View>
  );
};

// superlist-onboarding-flow-animation-end 🔼
