import { colors } from "@/theme/colors";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner = ({ size = 20, color = colors.white }: SpinnerProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 500,
        easing: Easing.linear,
      }),
      -1 // Infinite loop
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: size / 12,
            borderStyle: "solid",
            borderTopColor: "transparent",
            borderRightColor: color,
            borderBottomColor: color,
            borderLeftColor: color,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    borderStyle: "solid",
  },
});
