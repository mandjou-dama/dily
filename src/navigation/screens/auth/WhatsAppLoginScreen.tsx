import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Button from "@/components/Button";
import { simulatePress } from "@/lib/simulate-press";
import { ArrowLeft } from "lucide-react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";

type Props = NativeStackScreenProps<AuthStackParamList, "WhatsAppLogin">;

export const WhatsAppLoginScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const phoneRef = useRef<TextInput>(null);

  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    console.log("first");

    setIsLoading(true);

    setTimeout(() => {
      // Keyboard.dismiss();
      setIsLoading(false);
      navigation.navigate("VerificationCode");
    }, 2000);
  };

  const handleGoBack = () => {
    navigation.goBack();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        phoneRef.current?.focus();
        console.log("focused");
      }, 350);

      return () => {
        // clear the timeout set timeout
        clearTimeout(timer);
      };
    }, [])
  );

  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      keyboardVerticalOffset={0}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top * 1.5,
          paddingBottom: insets.bottom,
        }}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={[styles.container, { justifyContent: "space-between" }]}>
            <View>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 70,
                }}
              >
                <Pressable
                  onPress={handleGoBack}
                  style={[
                    {
                      position: "absolute",
                      left: 0,
                      zIndex: 50,
                      width: 48,
                      height: 48,
                      borderRadius: 13,
                      borderCurve: "continuous",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#E7E5E4",
                    },
                  ]}
                >
                  <ArrowLeft
                    style={{ pointerEvents: "none" }}
                    size={24}
                    color={colors.primary}
                  />
                </Pressable>
                {/* 
          <View
            style={[
              {
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: colors.primary,
                borderCurve: "continuous",
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Image
              style={{
                width: 40,
                height: 40,
              }}
              contentFit="cover"
              source={require("assets/splash-icon-light.png")}
            />
          </View> */}
              </View>

              <Text style={styles.title}>
                Enter your{" "}
                <Text
                  style={{
                    color: colors.primary,
                    textDecorationStyle: "solid",
                    textDecorationLine: "underline",
                  }}
                >
                  WhatsApp
                </Text>{" "}
                number to continue
              </Text>

              <View style={styles.inputContainer}>
                <View style={{}}>
                  <Text>+223</Text>
                </View>
                <TextInput
                  ref={phoneRef}
                  hitSlop={30}
                  style={styles.input}
                  placeholder="Your phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                />
              </View>

              <Button
                disabled={(phone.length >= 8 ? false : true) || isLoading}
                title="Continue"
                onPress={handleLogin}
                isLoading={isLoading}
              />
            </View>

            <View style={{}}>
              <Text style={{ textAlign: "center" }}>
                By continuing, you agree to our{" "}
              </Text>
              <Text style={{ textAlign: "center", color: colors.primary }}>
                Terms of Service and Privacy Policy
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.black,
    textAlign: "left",
    marginBottom: spacing.xl,
  },
  inputContainer: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E7E5E4",
    borderRadius: 13,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    fontSize: 14,
    color: colors.textPrimary,
    gap: spacing.md,
    marginBottom: 30,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
    // backgroundColor: "red",
    width: "80%",
  },
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 13,
    borderCurve: "continuous",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
});
