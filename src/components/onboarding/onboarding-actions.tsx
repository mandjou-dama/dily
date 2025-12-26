import React, { memo } from "react";
import { Pressable, Text } from "react-native";
import Animated from "react-native-reanimated";
import AntDesign from "@expo/vector-icons/AntDesign";
import { colors } from "@/theme/colors";

interface Props {
  rButtonsBlockStyle: any;
  onGooglePress: () => void;
  onApplePress: () => void;
}

const OnboardingActions = ({
  rButtonsBlockStyle,
  onGooglePress,
  onApplePress,
}: Props) => {
  console.log("OnboardingActions render"); // ← debug

  return (
    <Animated.View style={[rButtonsBlockStyle, { marginTop: "auto" }]}>
      <Text
        style={{
          color: colors.black,
          textAlign: "center",
          fontSize: 32,
          fontWeight: "bold",
        }}
      >
        Buy. Sell. Connect.
      </Text>

      <Text
        style={{
          color: colors.black,
          textAlign: "center",
          marginTop: 12,
        }}
      >
        A simple way to trade items
      </Text>

      <Text
        style={{
          color: colors.black,
          textAlign: "center",
        }}
      >
        with people near you.
      </Text>

      <Pressable
        onPress={onGooglePress}
        style={{
          borderCurve: "continuous",
          flexDirection: "row",
          height: 45,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 13,
          marginHorizontal: 80,
          marginTop: 32,
          backgroundColor: colors.white,
        }}
      >
        <AntDesign name="google" size={24} color={colors.black} />
        <Text style={{ color: colors.black }}>Continue with Google</Text>
      </Pressable>

      <Pressable
        onPress={onApplePress}
        style={{
          borderCurve: "continuous",
          flexDirection: "row",
          height: 45,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 13,
          marginHorizontal: 80,
          marginTop: 12,
          backgroundColor: colors.black,
        }}
      >
        <AntDesign name="apple" size={24} color={colors.white} />
        <Text style={{ color: colors.white }}>Continue with Apple</Text>
      </Pressable>
    </Animated.View>
  );
};

export default memo(OnboardingActions);
