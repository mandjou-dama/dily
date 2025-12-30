import { Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { FC } from "react";
import { OnboardingSlide } from "@/lib/types";
import { colors } from "@/theme/colors";
import { Image } from "expo-image";

// superlist-onboarding-flow-animation 🔽

type SlideItemProps = {
  item: OnboardingSlide;
  index: number;
  width: number;
  scrollOffsetX: SharedValue<number>;
};

const renderHighlightedText = (text: string) => {
  return text.split("**").map((part, index) => (
    <Text
      key={index}
      style={
        index % 2 === 1
          ? {
              color: colors.primary,
              fontWeight: "600",
              textDecorationColor: colors.primary,
              textDecorationStyle: "solid",
              textDecorationLine: "underline",
              fontFamily: "Clash Display",
            }
          : undefined
      }
    >
      {part}
    </Text>
  ));
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
      style={[{ width, paddingHorizontal: 10, paddingVertical: 20 }, rStyle]}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          paddingTop: 40,
          borderRadius: 24,
          elevation: 0,
          borderCurve: "continuous",
        }}
      >
        <View style={{ paddingHorizontal: 30 }}>
          <Text
            style={{
              color: colors.primary,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            {item.title}
          </Text>
          <Text
            style={{
              color: colors.black,
              fontSize: 16,
              textAlign: "center",
              opacity: 0.7,
            }}
          >
            {renderHighlightedText(item.subtitle)}
          </Text>
        </View>

        <Image
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            bottom: -30,
          }}
          source={item.image}
          contentFit="contain"
          transition={1000}
        />
      </View>
    </Animated.View>
  );
};
