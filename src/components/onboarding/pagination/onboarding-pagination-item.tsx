import { colors } from "@/theme/colors";
import { FC, useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// superlist-onboarding-flow-animation 🔽

type PaginationItemProps = {
  index: number;
  currentSlideIndex: number;
  animatedSlideIndex: SharedValue<number>;
  inactiveWidth: number;
  activeWidth: number;
  totalSlides: number;
  slideDuration: number;
  isDragging: SharedValue<boolean>;
  handleScrollToIndex: (index: number) => void;
  translateY: SharedValue<number>;
  topCarouselOffset: number;
};

export const PaginationItem: FC<PaginationItemProps> = ({
  index,
  currentSlideIndex,
  animatedSlideIndex,
  inactiveWidth,
  activeWidth,
  totalSlides,
  slideDuration,
  isDragging,
  handleScrollToIndex,
  translateY,
  topCarouselOffset,
}) => {
  // Progress from 0 to 1 for the active slide's progress bar animation
  const slideProgress = useSharedValue(0);

  // Interpolates pagination bar width based on scroll position
  // Active bar expands to 3x width, inactive bars shrink to base width
  const barWidth = useDerivedValue(() => {
    const adjustedIndex = animatedSlideIndex.get();
    // Normal interpolation: expands when current slide is active, shrinks when adjacent
    // Input range: [prev slide, current slide, next slide]
    // Output: [inactiveWidth, activeWidth, inactiveWidth] - creates smooth width transition
    let width = interpolate(
      adjustedIndex,
      [index - 1, index, index + 1],
      [inactiveWidth, activeWidth, inactiveWidth],
      Extrapolation.CLAMP
    );

    // Handle infinite loop: when scrolling from last slide (index 4) to first (index 0)
    // The carousel duplicates the first slide at the end, so index 5 = slide 0
    if (index === 0) {
      // When at last slide (index 4) transitioning to duplicated first (index 5)
      // First pagination bar should expand smoothly
      const loopFromLastWidth = interpolate(
        adjustedIndex,
        [totalSlides - 1, totalSlides],
        [inactiveWidth, activeWidth],
        Extrapolation.CLAMP
      );

      width = Math.max(width, loopFromLastWidth);
    }

    if (index === totalSlides - 1) {
      // When transitioning from last slide to duplicated first, last bar should shrink
      const loopToFirstWidth = interpolate(
        adjustedIndex,
        [totalSlides - 1, totalSlides],
        [activeWidth, inactiveWidth],
        Extrapolation.CLAMP
      );

      width = adjustedIndex >= totalSlides - 1 ? loopToFirstWidth : width;
    }

    return width;
  });

  const rBarWidthStyle = useAnimatedStyle(() => {
    return {
      width: barWidth.get(),
    };
  }, []);

  // Animated style for the white progress bar that fills the active pagination indicator
  const rBarProgressStyle = useAnimatedStyle(() => {
    // Cancel auto-advance progress when user manually drags
    if (isDragging.get()) {
      cancelAnimation(slideProgress);
    }

    // Interpolate progress (0-1) to percentage width (0-100%)
    // Creates the filling effect as slide auto-advances
    const progressWidth = interpolate(
      slideProgress.get(),
      [0, 1],
      [0, 100],
      Extrapolation.CLAMP
    );

    return {
      width: `${progressWidth}%`,
      // Fade in progress bar only when pagination indicator is expanded (active)
      // Prevents progress bar from showing on inactive indicators
      opacity: interpolate(
        barWidth.get(),
        [0, activeWidth],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  }, []);

  // Start progress animation when this slide becomes active
  useEffect(() => {
    if (currentSlideIndex === index) {
      slideProgress.set(0);
      // Animate progress bar from 0 to 1 over slideDuration (2000-3000ms)
      slideProgress.set(withTiming(1, { duration: slideDuration }));
    } else {
      slideProgress.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlideIndex]);

  // Resume progress animation after user finishes dragging
  // Prevents progress from restarting mid-drag, ensuring smooth UX
  useAnimatedReaction(
    () => ({ isDragging: isDragging.get() }),
    ({ isDragging }) => {
      if (
        !isDragging &&
        currentSlideIndex === index &&
        slideProgress.get() > 0
      ) {
        slideProgress.set(0);
        slideProgress.set(withTiming(1, { duration: slideDuration }));
      }
    }
  );

  // Auto-advance to next slide when progress completes, or expand carousel on last slide
  useAnimatedReaction(
    () => ({ slideProgress: slideProgress.get() }),
    ({ slideProgress }) => {
      // On last slide completion, expand carousel upward to reveal sign-in buttons
      if (slideProgress === 1 && currentSlideIndex === totalSlides - 1) {
        isDragging.set(true);
        translateY.set(
          withTiming(-topCarouselOffset, {
            duration: 200,
            easing: Easing.inOut(Easing.quad),
          })
        );
      }
      // Auto-advance to next slide when progress completes (unless user is dragging)
      if (!isDragging.get() && slideProgress === 1) {
        scheduleOnRN(handleScrollToIndex, currentSlideIndex + 1);
      }
    }
  );

  return (
    <Animated.View
      //   className="h-[2px] rounded-full bg-slate-600 overflow-hidden"
      style={[
        rBarWidthStyle,
        {
          height: 2,
          borderRadius: 9999,
          backgroundColor: "rgba(60, 86, 39, 0.2)",
          overflow: "hidden",
        },
      ]}
    >
      <Animated.View
        // className="bg-white absolute top-0 bottom-0 left-0"
        style={[
          rBarProgressStyle,
          {
            backgroundColor: colors.primary,
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
          },
        ]}
      />
    </Animated.View>
  );
};

// superlist-onboarding-flow-animation 🔼
