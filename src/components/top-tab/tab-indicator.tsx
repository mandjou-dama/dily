import { colors } from "@/theme/colors";
import React, { FC } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

// threads-home-header-tabs-animation 🔽

type Props = {
  indexDecimal: SharedValue<number>;
  numberOfTabs: number;
  tabsHorizontalPadding: number;
};

export const TabIndicator: FC<Props> = ({
  indexDecimal,
  numberOfTabs,
  tabsHorizontalPadding,
}) => {
  // Screen width used for responsive tab calculations across different devices
  const { width } = useWindowDimensions();

  // Calculate individual tab width: screen width minus total padding divided by tab count
  // Ensures equal distribution regardless of tab names or screen size
  const tabBarItemWidth = (width - tabsHorizontalPadding * 2) / numberOfTabs;

  const rIndicatorStyle = useAnimatedStyle(() => {
    // Interpolate indicator position based on current tab index
    // Input range [0, 1] maps to tab positions [0, tabWidth] for smooth sliding
    // Note: This assumes only 2 tabs; for multiple tabs, range would be [0, 1, 2, ...]
    const translateX = interpolate(
      indexDecimal.value,
      [0, 1],
      [0, tabBarItemWidth]
    );

    return {
      width: tabBarItemWidth, // Indicator width matches tab width for precise alignment
      // translateX + padding positions indicator correctly within tab boundaries
      transform: [{ translateX: translateX + tabsHorizontalPadding }],
    };
  });

  // 1px height (h-px) creates subtle underline effect matching Threads design
  return (
    <Animated.View
      //   className="h-px rounded-full bg-white"
      style={[
        {
          height: 1,
          borderRadius: 9999,
          backgroundColor: colors.primary,
        },
        rIndicatorStyle,
      ]}
    />
  );
};

// threads-home-header-tabs-animation 🔼
