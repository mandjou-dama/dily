import { Assets as NavigationAssets } from "@react-navigation/elements";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Asset } from "expo-asset";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as React from "react";
import { useEffect, useState } from "react";
import { Platform, StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@/i18n";
import { Navigation } from "@/navigation";
import { AnimatedBootSplash } from "@/components/animated-boot-splash";
import BootSplash from "react-native-bootsplash";
import { NotifyProvider } from "./components/notify";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { ChatProvider } from "@/providers/chat-provider";
import { notificationUrl, setupNotifications } from "@/lib/push";

Asset.loadAsync([...NavigationAssets, require("assets/splash-icon-light.png")]);
setupNotifications();

const prefix = Linking.createURL("/");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A tapped message notification opens its conversation, like a dily://chat/<id> link
const linking = {
  enabled: "auto" as const,
  prefixes: [prefix],
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) return url;
    const tapped = Notifications.getLastNotificationResponse();
    // Read once: a later launch from the icon must not reopen it
    Notifications.clearLastNotificationResponse();
    return notificationUrl(tapped);
  },
  subscribe(listener: (url: string) => void) {
    const links = Linking.addEventListener("url", ({ url }) => listener(url));
    const taps = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = notificationUrl(response);
        if (url) listener(url);
      },
    );
    return () => {
      links.remove();
      taps.remove();
    };
  },
};

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
                <ChatProvider>
                  {/* Sheets render here, with the session and the cache */}
                  <BottomSheetModalProvider>
                    <AppNavigation theme={theme} />
                  </BottomSheetModalProvider>
                </ChatProvider>
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
