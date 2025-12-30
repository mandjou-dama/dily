import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,

  SCREEN_WIDTH: width,
  SCREEN_HEIGHT: height,
} as const;
