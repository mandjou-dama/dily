import { FlatList } from "react-native-gesture-handler";
import { SharedValue } from "react-native-reanimated";

// superlist-onboarding-flow-animation 🔽

/**
 * Represents a single slide in the onboarding carousel
 */
export type OnboardingSlide = {
  /** Background color of the slide */
  bgColor: string;
  /** Duration in milliseconds for the slide's progress animation */
  duration: number;
  /** Title of the slide */
  title: string;
};

export type CarouselProps = {
  SLIDES: OnboardingSlide[];
  setCurrentSlideIndex: (index: number) => void;
  horizontalListRef: React.RefObject<FlatList<OnboardingSlide> | null>;
  scrollHandler: (event: any) => void;
  currentSlideIndex: number;
  // Vertical translation for swipe-up gesture: 0 = collapsed, -topCarouselOffset = expanded
  translateY: SharedValue<number>;
  // Horizontal scroll position in pixels, drives slide card animations (rotate/translateY)
  scrollOffsetX: SharedValue<number>;
  // Prevents auto-advance during user interaction, resets progress animations
  isDragging: SharedValue<boolean>;
  // Continuous slide index (0, 1, 2...) derived from scrollOffsetX, enables smooth pagination width interpolation
  animatedSlideIndex: SharedValue<number>;
  // Distance in pixels to translate carousel up when expanded (230px)
  topCarouselOffset: number;
};

// superlist-onboarding-flow-animation 🔼
