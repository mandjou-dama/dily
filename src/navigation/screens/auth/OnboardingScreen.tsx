import { ChevronDown, Mail, UserRound } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import Animated, {
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

// superlist-onboarding-flow-animation 🔽

export const SLIDES: OnboardingSlide[] = [
  {
    bgColor: "#7872E0",
    duration: 3000,
    title: "Create tasks at the speed of thought",
  },
  {
    bgColor: "#FB5A44",
    duration: 3000,
    title: "Take notes and transform thoughts into action",
  },
  {
    bgColor: "#7872E0",
    duration: 3000,
    title: "Start your next project in seconds using AI templates",
  },
  {
    bgColor: "#2188DA",
    duration: 2000,
    title: "Organize your team with shared lists and tasks",
  },
  {
    bgColor: "#7872E0",
    duration: 3000,
    title: "Get things done with a bit more fun",
  },
];

// Distance in pixels to translate carousel upward when fully expanded
// Reveals sign-in buttons below carousel
const TOP_CAROUSEL_OFFSET = 230;
// Minimum swipe distance (in pixels) to trigger expand/collapse transition
// Prevents accidental toggles from small finger movements
const SWIPE_UP_THRESHOLD = 20;

export const OnboardingScreen = () => {
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
    <GestureDetector gesture={Gesture.Race(panGesture, singleTap)}>
      <View
        // className="flex-1 bg-slate-900"
        style={{
          paddingBottom: insets.bottom + 10,
          flex: 1,
          backgroundColor: "black",
        }}
      >
        <Animated.View
          // className="mt-auto"
          style={[rButtonsBlockStyle, { marginTop: "auto" }]}
        >
          <Pressable
            // className="self-center mb-6"
            style={{ alignSelf: "center", marginBottom: 24 }}
            onPress={slideBottomHandler}
          >
            <ChevronDown size={26} color="grey" />
          </Pressable>
          <Text
            //   className="text-white text-center text-4xl font-bold"
            style={{
              color: "white",
              textAlign: "center",
              fontSize: 32,
              fontWeight: "bold",
            }}
          >
            Let's get started
          </Text>
          <Text
            // className="text-slate-400 text-center mt-3"
            style={{
              color: "white",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Sign in to get things done - your task,
          </Text>
          <Text
            // className="text-slate-400 text-center"
            style={{
              color: "white",
              textAlign: "center",
            }}
          >
            notes, and meetings all in one place
          </Text>
          <Pressable
            onPress={simulatePress}
            // className="flex-row h-[40px] items-center justify-center gap-2 rounded-full mx-20 mt-8 bg-white"
            style={{
              borderCurve: "continuous",
              flexDirection: "row",
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 9999,
              marginHorizontal: 80,
              marginTop: 32,
              backgroundColor: "#FFFFFF",
            }}
          >
            <AntDesign name="google" size={24} color="black" />
            <Text style={{ color: "black" }}>Continue with Google</Text>
          </Pressable>
          <Pressable
            onPress={simulatePress}
            // className="flex-row h-[40px] items-center justify-center gap-2 rounded-full mx-20 mt-3 bg-white"
            style={{
              borderCurve: "continuous",
              flexDirection: "row",
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 9999,
              marginHorizontal: 80,
              marginTop: 12,
              backgroundColor: "#FFFFFF",
            }}
          >
            <AntDesign name="apple" size={24} color="black" />
            <Text style={{ color: "black" }}>Continue with Apple</Text>
          </Pressable>
        </Animated.View>
        <Pressable
          onPress={simulatePress}
          //   className="h-[40px] items-center justify-center rounded-full mx-20 mt-3 bg-slate-700 overflow-hidden"
          style={{
            borderCurve: "continuous",
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            marginHorizontal: 80,
            marginTop: 12,
            backgroundColor: "#334155",
            overflow: "hidden",
          }}
        >
          <Animated.View
            //   className="flex-row gap-2 pt-0"
            style={[
              {
                flexDirection: "row",
                gap: 8,
                paddingTop: 0,
              },
              rSignUpStyle,
            ]}
          >
            <UserRound size={16} color="white" />
            <Text style={{ color: "white" }}>Sign Up / Sign In</Text>
          </Animated.View>
          <Animated.View
            //   className="flex-row gap-2 -mt-5"
            style={[
              {
                flexDirection: "row",
                gap: 8,
                marginTop: -12,
              },
              rContinueWithEmailStyle,
            ]}
          >
            <Mail size={16} color="white" />
            <Text style={{ color: "white" }}>Continue with email</Text>
          </Animated.View>
        </Pressable>

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

        <Animated.View
          //   className="absolute inset-0 pointer-events-none"
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
            colors={["rgba(0,0,0,0.6)", "transparent"]}
            style={{ width: "100%", height: "60%" }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

// superlist-onboarding-flow-animation-end 🔼
