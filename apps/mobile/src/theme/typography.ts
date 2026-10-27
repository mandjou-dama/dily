import { TextStyle } from "react-native";

/** Newsreader, the listing titles' serif: loaded at startup (App.tsx). */
export const fonts = {
  serif: "Newsreader_500Medium",
} as const;

export const fontAssets = {
  [fonts.serif]: require("@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf"),
};

export const typography: Record<string, TextStyle> = {
  title: {
    fontSize: 28,
    fontWeight: "600",
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
  },
  small: {
    fontSize: 12,
  },
};
