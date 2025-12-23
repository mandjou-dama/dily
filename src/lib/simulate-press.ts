import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

export const simulatePress = () => {
  if (__DEV__) {
    Alert.alert("Pressed");
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
