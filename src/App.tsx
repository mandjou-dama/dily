import { Assets as NavigationAssets } from "@react-navigation/elements";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { createURL } from "expo-linking";
import * as React from "react";
import { useEffect, useState } from "react";
import { Platform, StatusBar, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider preload={false}>
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
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
