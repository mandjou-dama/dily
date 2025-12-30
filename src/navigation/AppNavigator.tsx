import React, { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, StyleSheet, useWindowDimensions, Pressable } from "react-native";

import { AppTabParamList } from "@/types/navigation";
import { HomeScreen } from "@/navigation/screens/home/HomeScreen";
import { CreateProductScreen } from "@/navigation/screens/product/CreateProductScreen";
import { ChatScreen } from "@/navigation/screens/chat/ChatScreen";
import { ProfileScreen } from "@/navigation/screens/profile/ProfileScreen";

import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colorKit } from "reanimated-color-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { HandCoins, HomeIcon, MessagesSquare, User } from "lucide-react-native";

const Tab = createBottomTabNavigator<AppTabParamList>();

enum TabEnum {
  Home = "Home",
  Sell = "Sell",
  Chat = "Chat",
  Profile = "Profile",
}

const TAB_BAR_HEIGHT_WITHOUT_INSET = 40;
const ANIMATED_BAR_HEIGHT = 1;

export const AppNavigator = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tabBarPaddingBottom = insets.bottom + 10;
  const tabBarHeight = tabBarPaddingBottom + TAB_BAR_HEIGHT_WITHOUT_INSET;
  const animatedBarWidth = width / Object.keys(TabEnum).length;

  const currentTab = useSharedValue(TabEnum.Home);

  const updateTab = (tab: TabEnum) => {
    currentTab.value = tab;
  };

  // define the order of tabs exactly as you rendered them:
  const tabOrder = useMemo<TabEnum[]>(
    () => [TabEnum.Home, TabEnum.Sell, TabEnum.Chat, TabEnum.Profile],
    []
  );

  const left: Record<TabEnum, number> = {
    [TabEnum.Home]: 2, // 2px left margin prevents edge collision
    [TabEnum.Sell]: animatedBarWidth, // 1x width = second tab position
    [TabEnum.Chat]: animatedBarWidth * 2, // 2x width = third tab position
    [TabEnum.Profile]: animatedBarWidth * 3, // 3x width = fourth tab position
  };

  const rAnimatedBarStyle = useAnimatedStyle(() => {
    return {
      // withTiming creates smooth position transitions between tab selections
      left: withTiming(left[currentTab.value], {
        duration: 200, // 200ms duration provides responsive feel without being jarring
        easing: Easing.inOut(Easing.quad), // Quad easing: gentle acceleration/deceleration for natural motion
      }),
    };
  });

  return (
    <>
      <Tab.Navigator
        initialRouteName={TabEnum.Home}
        screenOptions={{
          headerShown: true,
          headerTransparent: true,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.gray,
          tabBarStyle: {
            height: tabBarHeight,
            overflow: "hidden",
            paddingBottom: tabBarPaddingBottom,
            borderColor: colorKit.setAlpha("#1e1e1e", 0.2).hex(),
            backgroundColor: colors.background,
          },
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              style={props.style}
              android_ripple={{ color: "transparent" }} // Disables Android ripple to prevent visual conflicts with indicator
            >
              {props.children}
            </Pressable>
          ),
        }}
        screenListeners={{
          // fires on *any* navigation change in this Tabs navigator
          state: (e) => {
            const newIndex = e.data.state.index;
            const newTab = tabOrder[newIndex] ?? TabEnum.Home;
            runOnJS(updateTab)(newTab);
          },
        }}
      >
        <Tab.Screen
          name={TabEnum.Home}
          component={HomeScreen}
          options={{
            headerShown: false,
            headerTransparent: false,
            tabBarLabel: "Discover",
            headerTitleAlign: "center",
            tabBarIcon: ({ focused }) => (
              <HomeIcon stroke={focused ? colors.primary : colors.gray} />
            ),
          }}
        />
        <Tab.Screen
          name={TabEnum.Sell}
          component={CreateProductScreen}
          options={{
            headerShown: false,
            headerTransparent: false,
            tabBarLabel: "Sell",
            headerTitleAlign: "center",
            tabBarIcon: ({ focused }) => (
              <HandCoins stroke={focused ? colors.primary : colors.gray} />
            ),
          }}
        />
        <Tab.Screen
          name={TabEnum.Chat}
          component={ChatScreen}
          options={{
            headerShown: false,
            headerTransparent: false,
            tabBarLabel: "Chat",
            headerTitleAlign: "center",
            tabBarIcon: ({ focused }) => (
              <MessagesSquare stroke={focused ? colors.primary : colors.gray} />
            ),
          }}
        />
        <Tab.Screen
          name={TabEnum.Profile}
          component={ProfileScreen}
          options={{
            headerShown: false,
            headerTransparent: false,
            tabBarLabel: "Profile",
            headerTitleAlign: "center",
            tabBarIcon: ({ focused }) => (
              <User stroke={focused ? colors.primary : colors.gray} />
            ),
          }}
        />
      </Tab.Navigator>

      <Animated.View
        style={[
          rAnimatedBarStyle,
          {
            width: animatedBarWidth,
            height: ANIMATED_BAR_HEIGHT,
            bottom: tabBarHeight - ANIMATED_BAR_HEIGHT,
            position: "absolute",
            left: 0,
            right: 0,
            borderRadius: 100,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </>
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
    backgroundColor: "#ccc",
  },
});
