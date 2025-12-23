import { FC } from "react";
import { View, useWindowDimensions } from "react-native";
import { SharedValue } from "react-native-reanimated";
import { OnboardingSlide } from "@/lib/types";
import { PaginationItem } from "./onboarding-pagination-item";

// superlist-onboarding-flow-animation 🔽

type PaginationProps = {
  slides: OnboardingSlide[];
  currentSlideIndex: number;
  animatedSlideIndex: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  handleScrollToIndex: (index: number) => void;
  translateY: SharedValue<number>;
  topCarouselOffset: number;
};

export const Pagination: FC<PaginationProps> = ({
  slides,
  currentSlideIndex,
  animatedSlideIndex,
  isDragging,
  handleScrollToIndex,
  translateY,
  topCarouselOffset,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  // 25% padding on each side for centered pagination (50% total horizontal padding)
  const HORIZONTAL_PADDING = screenWidth * 0.25;
  // Gap between pagination indicators in pixels
  const GAP = 3;

  const totalPaginationWidth = screenWidth - HORIZONTAL_PADDING;
  const totalGaps = (slides.length - 1) * GAP;

  // Calculate base width accounting for active item expansion
  // Active item expands to 3x width, so we reserve space: slides.length + 2 extra widths
  // This ensures pagination doesn't overflow when active item expands
  const totalItems = slides.length + 2; // We add here because we have 2 extra widths for the active item
  const itemWidth = (totalPaginationWidth - totalGaps) / totalItems;

  // Base width for inactive pagination indicators
  const inactiveWidth = itemWidth;
  // Expanded width when pagination indicator is active (3x multiplier creates visual emphasis)
  const activeWidth = itemWidth * 3;

  return (
    <View
      //   className="flex-row items-center justify-center pb-4 px-20"
      style={{
        gap: GAP,
        paddingHorizontal: HORIZONTAL_PADDING / 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 16,
        // paddingHorizontal: 80,
      }}
    >
      {slides.map((slide, index) => (
        <PaginationItem
          key={index}
          index={index}
          currentSlideIndex={currentSlideIndex}
          animatedSlideIndex={animatedSlideIndex}
          inactiveWidth={inactiveWidth}
          activeWidth={activeWidth}
          totalSlides={slides.length}
          isDragging={isDragging}
          slideDuration={slide.duration}
          handleScrollToIndex={handleScrollToIndex}
          translateY={translateY}
          topCarouselOffset={topCarouselOffset}
        />
      ))}
    </View>
  );
};

export default Pagination;

// superlist-onboarding-flow-animation 🔼
