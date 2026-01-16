import { colors } from "@/theme/colors";
import React, { FC } from "react";
import { Pressable, TouchableOpacity } from "react-native";
import Reanimated, {
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

// threads-home-header-tabs-animation 🔽

type Props = {
  index: number;
  tabName: string;
  indexDecimal: SharedValue<number>;
  onPress: () => void;
};

export const TabItem: FC<Props> = ({
  index,
  tabName,
  indexDecimal,
  onPress,
}) => {
  const rTextStyle = useAnimatedStyle(() => {
    // Three-point color interpolation creates smooth transitions between tabs
    // Range [index-1, index, index+1] ensures current tab is white, others are gray
    // This creates a "spotlight" effect as indexDecimal moves between tab indices
    const color = interpolateColor(
      indexDecimal.value,
      [index - 1, index, index + 1], // Input range: previous tab, current tab, next tab
      [colors.black + "80", colors.primary, colors.black + "80"] // Output colors: inactive gray, active white, inactive gray
    );
    return { color };
  });

  return (
    <Pressable
      hitSlop={20}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Reanimated.Text
        style={[
          {
            fontSize: 14,
            fontWeight: "300",
            textTransform: "uppercase",
          },
          rTextStyle,
        ]}
      >
        {tabName}
      </Reanimated.Text>
    </Pressable>
  );
};

// threads-home-header-tabs-animation 🔼
