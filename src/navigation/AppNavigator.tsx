import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, StyleSheet } from "react-native";

import { AppTabParamList } from "@/types/navigation";
import { HomeScreen } from "@/navigation/screens/home/HomeScreen";
import { CreateProductScreen } from "@/navigation/screens/product/CreateProductScreen";
import { ChatScreen } from "@/navigation/screens/chat/ChatScreen";
import { ProfileScreen } from "@/navigation/screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator<AppTabParamList>();

const PlaceholderIcon = () => <View style={styles.icon} />;

export const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => <PlaceholderIcon />,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Sell" component={CreateProductScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
    backgroundColor: "#ccc",
  },
});
