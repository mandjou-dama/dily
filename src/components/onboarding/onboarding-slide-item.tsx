import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { FC } from "react";
import { OnboardingSlide } from "@/lib/types";

// superlist-onboarding-flow-animation 🔽

type SlideItemProps = {
  item: OnboardingSlide;
  index: number;
  width: number;
  scrollOffsetX: SharedValue<number>;
};

export const SlideItem: FC<SlideItemProps> = ({
  item,
  index,
  width,
  scrollOffsetX,
}) => {
  // Animated style for slide card transforms during horizontal scroll
  // Creates parallax-like effect: cards rotate and translate vertically as user swipes
  const rStyle = useAnimatedStyle(() => {
    // Input range: [previous slide center, current slide center, next slide center]
    // Each slide is screenWidth pixels wide, so centers are at width * index
    const inputRange = [
      width * (index - 1),
      width * index,
      width * (index + 1),
    ];

    // Rotation interpolation: card tilts ±2deg when adjacent to center
    // Creates depth perception as cards rotate away from center position
    const rotate = interpolate(
      scrollOffsetX.get(),
      inputRange,
      [2, 0, -2],
      Extrapolation.CLAMP
    );
    // Vertical translation: card moves ±4px vertically when adjacent
    // Combined with rotation, creates 3D card stack effect
    const translateY = interpolate(
      scrollOffsetX.get(),
      inputRange,
      [4, 0, 4],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }, { rotate: `${rotate}deg` }],
    };
  }, [scrollOffsetX, index, width]);

  return (
    <Animated.View
      // className="px-7 py-5"
      style={[{ width, paddingHorizontal: 28, paddingVertical: 20 }, rStyle]}
    >
      <View
        // className="flex-1 items-center p-20 px-8 rounded-3xl"
        style={{
          flex: 1,
          alignItems: "center",
          paddingVertical: 80,
          paddingHorizontal: 32,
          borderRadius: 24,
          backgroundColor: item.bgColor,
          shadowColor: "black",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 3,
          borderCurve: "continuous",
        }}
      >
        <Text
          // className="text-white text-4xl font-bold text-center mb-20"
          style={{
            color: "white",
            fontSize: 36,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: 80,
          }}
        >
          {item.title}
        </Text>
        <View
          // className="w-3/4 aspect-[1/1.3] rounded-3xl bg-white/20"
          style={{
            width: "75%",
            aspectRatio: 1 / 1.3,
            borderRadius: 24,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
          }}
        />
      </View>
    </Animated.View>
  );
};

// superlist-onboarding-flow-animation 🔼
