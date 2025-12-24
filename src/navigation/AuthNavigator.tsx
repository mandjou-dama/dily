import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthStackParamList } from "@/types/navigation";
import { RegisterScreen } from "@/navigation/screens/auth/RegisterScreen";
import { OnboardingScreen } from "@/navigation/screens/auth/OnboardingScreen";
import { WhatsAppLoginScreen } from "./screens/auth/WhatsAppLoginScreen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="WhatsAppLogin" component={WhatsAppLoginScreen} />
    </Stack.Navigator>
  );
};
