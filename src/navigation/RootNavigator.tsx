import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import { AuthNavigator } from "./AuthNavigator";
import { AppNavigator } from "./AppNavigator";

import { ProductDetailsScreen } from "./screens/product/ProductDetailsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        <Stack.Screen name="App" component={AppNavigator} />
        <Stack.Screen name="Auth" component={AuthNavigator} />
        {/* <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
