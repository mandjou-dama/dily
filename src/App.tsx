import { Assets as NavigationAssets } from "@react-navigation/elements";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { createURL } from "expo-linking";
import * as React from "react";
import { useEffect, useState } from "react";
import { Platform, StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Navigation } from "@/navigation";
import { AnimatedBootSplash } from "@/components/animated-boot-splash";
import BootSplash from "react-native-bootsplash";
import { NotifyProvider } from "./components/notify";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

Asset.loadAsync([...NavigationAssets, require("assets/splash-icon-light.png")]);

const prefix = createURL("/");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const linking = { enabled: "auto" as const, prefixes: [prefix] };

// The `if` hooks of the root stack need the restored session: mounting before
// it is read would show the auth screens for a frame to signed-in users
function AppNavigation({ theme }: { theme: typeof DefaultTheme }) {
  const { isLoading } = useAuth();
  if (isLoading) return null;

  return <Navigation theme={theme} linking={linking} />;
}

export function App() {
  const colorScheme = useColorScheme();
  const [splashVisible, setSplashVisible] = useState(true);

  const theme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  useEffect(() => {
    // Status bar config
    StatusBar.setBarStyle(
      colorScheme === "dark" ? "light-content" : "dark-content",
    );

    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent");
      StatusBar.setTranslucent(true);
    }
  }, [colorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider preload={false}>
            <NotifyProvider>
              <AuthProvider>
                <AppNavigation theme={theme} />
              </AuthProvider>

              {/* Splash overlay */}
              {splashVisible && (
                <AnimatedBootSplash
                  onAnimationEnd={async () => {
                    setSplashVisible(false);
                    await BootSplash.hide({ fade: true });
                  }}
                />
              )}
            </NotifyProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
