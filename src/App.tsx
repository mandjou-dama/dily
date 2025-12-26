import { Assets as NavigationAssets } from "@react-navigation/elements";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { createURL } from "expo-linking";
import * as React from "react";
import { useEffect, useState } from "react";
import { Platform, StatusBar, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Navigation } from "@/navigation";
import { AnimatedBootSplash } from "@/components/animated-boot-splash";
import BootSplash from "react-native-bootsplash";
import { colors } from "./theme/colors";

Asset.loadAsync([
  ...NavigationAssets,
  require("./assets/newspaper.png"),
  require("./assets/bell.png"),
]);

const prefix = createURL("/");

export function App() {
  const colorScheme = useColorScheme();
  const [splashVisible, setSplashVisible] = useState(true);

  const theme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  useEffect(() => {
    // Status bar config
    StatusBar.setBarStyle(
      colorScheme === "dark" ? "light-content" : "dark-content"
    );

    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent");
      StatusBar.setTranslucent(true);
    }
  }, [colorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* Navigation mounts immediately */}
        <Navigation
          theme={theme}
          linking={{
            enabled: "auto",
            prefixes: [prefix],
          }}
        />

        {/* Splash overlay */}
        {splashVisible && (
          <AnimatedBootSplash
            onAnimationEnd={async () => {
              setSplashVisible(false);
              await BootSplash.hide({ fade: true });
            }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}
