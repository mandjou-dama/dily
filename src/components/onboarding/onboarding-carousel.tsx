import { FC, useCallback, useMemo, useRef, useState } from "react";
import { Platform, useWindowDimensions, ViewToken } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SlideItem } from "./onboarding-slide-item";
import Pagination from "./pagination";
import { CarouselProps, OnboardingSlide } from "@/lib/types";
import { scheduleOnRN } from "react-native-worklets";
import { FlatList } from "react-native-gesture-handler";

// superlist-onboarding-flow-animation 🔽

// Create animated version of FlatList to enable scroll-driven animations
// Required for useAnimatedScrollHandler to work with FlatList scroll events
// See: https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<OnboardingSlide>
);

const Carousel: FC<CarouselProps> = ({
  setCurrentSlideIndex,
  horizontalListRef,
  scrollHandler,
  currentSlideIndex,
  translateY,
  scrollOffsetX,
  SLIDES,
  isDragging,
  animatedSlideIndex,
  topCarouselOffset,
}) => {
  // Disable horizontal scroll when carousel is expanded (swiped up)
  // Prevents scroll conflicts between vertical pan gesture and horizontal carousel scroll
  const [isHorizontalScrollEnabled, setIsHorizontalScrollEnabled] =
    useState(false);

  // Duplicate first slide at end to enable infinite loop scrolling
  // When user reaches duplicated slide, we instantly jump back to real first slide
  const data = useMemo(() => [...SLIDES, SLIDES.at(0)!], []);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        // Get the first viewable item (should be only one with pagingEnabled)
        const viewableItem = viewableItems[0];
        if (viewableItem && viewableItem.index !== null) {
          setCurrentSlideIndex(viewableItem.index);
        }
      }
    },
    [setCurrentSlideIndex]
  );

  // Viewability config: only trigger when slide is 100% visible (pagingEnabled ensures this)
  // minimumViewTime: 0 means immediate callback, no delay needed for paged scrolling
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 100,
    minimumViewTime: 0,
  }).current;

  const handleScrollToIndex = useCallback((index: number) => {
    horizontalListRef.current?.scrollToIndex({
      index,
      animated: true,
    });
  }, []);

  // Animated container style: translates carousel vertically for swipe-up gesture
  // translateY: 0 = collapsed (default), -topCarouselOffset = fully expanded
  const rContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.get() }],
    };
  });

  // Pagination fade-out animation: hides pagination as carousel expands upward
  // Fades out in first 25% of expansion (0 to -57.5px) for smooth transition
  // pointerEvents: "none" prevents pagination taps when carousel is expanded
  const rPaginationStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateY.get(),
        [0, -topCarouselOffset * 0.25],
        [1, 0],
        Extrapolation.CLAMP
      ),
      pointerEvents: translateY.get() === 0 ? "auto" : "none",
    };
  });

  // Determine if carousel is expanded past midpoint threshold
  // Used to disable horizontal scrolling when carousel is mostly expanded
  const isExpanded = useDerivedValue(() => {
    if (translateY.get() <= -topCarouselOffset / 2) {
      return true;
    } else {
      return false;
    }
  });

  // Disable horizontal scroll when expanded to prevent gesture conflicts
  // Vertical pan gesture takes priority when carousel is swiped up
  useAnimatedReaction(
    () => isExpanded.get(),
    (isExpanded) => {
      if (isExpanded) {
        scheduleOnRN(setIsHorizontalScrollEnabled, false);
      } else {
        scheduleOnRN(setIsHorizontalScrollEnabled, true);
      }
    }
  );

  return (
    <Animated.View
      // className="absolute w-full"
      style={[
        {
          position: "absolute",
          width: "100%",
          top: insets.top,
          height: screenHeight - insets.top - insets.bottom - 60,
        },
        rContainerStyle,
      ]}
    >
      <AnimatedFlatList
        ref={horizontalListRef}
        data={data}
        renderItem={({ item, index }) => (
          <SlideItem
            item={item}
            index={index}
            width={screenWidth}
            scrollOffsetX={scrollOffsetX}
          />
        )}
        horizontal
        pagingEnabled
        initialScrollIndex={0}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        // 16ms throttle = ~60fps, ensures smooth scroll-driven animations
        // Lower values (1-4ms) cause performance issues, higher values (32ms+) feel laggy
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Infinite loop: when user reaches duplicated first slide (last item)
        // Instantly jump back to real first slide without animation
        onEndReached={() => {
          if (Platform.OS === "android") {
            // Android needs delay to prevent scroll conflict during momentum scrolling
            // Without delay, scrollToIndex can conflict with ongoing scroll momentum
            setTimeout(() => {
              horizontalListRef?.current?.scrollToIndex({
                index: 0,
                animated: false,
              });
            }, 100);
          } else {
            horizontalListRef?.current?.scrollToIndex({
              index: 0,
              animated: false,
            });
          }
        }}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={isHorizontalScrollEnabled}
      />
      <Animated.View style={rPaginationStyle}>
        <Pagination
          slides={SLIDES}
          currentSlideIndex={currentSlideIndex}
          animatedSlideIndex={animatedSlideIndex}
          isDragging={isDragging}
          handleScrollToIndex={handleScrollToIndex}
          translateY={translateY}
          topCarouselOffset={topCarouselOffset}
        />
      </Animated.View>
    </Animated.View>
  );
};

export default Carousel;

// superlist-onboarding-flow-animation 🔼
