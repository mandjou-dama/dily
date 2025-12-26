import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { OtpInput, OtpInputRef } from "react-native-otp-entry";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Button from "@/components/Button";
import { simulatePress } from "@/lib/simulate-press";
import { ArrowLeft } from "lucide-react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

type Props = NativeStackScreenProps<AuthStackParamList, "VerificationCode">;

export const VerificationCodeScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const phoneInputRef = useRef<OtpInputRef>(null);

  const handleLogin = useCallback(() => {
    console.log("Login", phone);
  }, [phone]);

  const handleGoBack = () => {
    navigation.goBack();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (error) {
      // Small delay to ensure the input is ready
      const timer = setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [error]);

  const confirmOtp = async (phone: string, code: string) => {
    setIsLoading(true);

    // mock api call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsLoading(false);
    setSuccess(true);
  };

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
                Enter the{" "}
                <Text
                  style={{
                    color: colors.primary,
                    textDecorationStyle: "solid",
                    textDecorationLine: "underline",
                  }}
                >
                  confirmation code
                </Text>{" "}
                sent to your WhatsApp
              </Text>

              <OtpInput
                ref={phoneInputRef}
                numberOfDigits={4}
                focusColor={colors.primary}
                autoFocus={true}
                hideStick={true}
                placeholder="2004"
                blurOnFilled={false}
                disabled={isLoading}
                type="numeric"
                secureTextEntry={false}
                focusStickBlinkingDuration={500}
                onTextChange={(text) => {
                  setCode(text);
                  if (text.length === 3) {
                    setError(false);
                  }
                }}
                onFilled={(text) =>
                  confirmOtp(
                    `+223${phone.toString().replace(/\s+/g, "")}`,
                    text
                  )
                }
                textInputProps={{
                  accessibilityLabel: "One-Time Password",
                }}
                textProps={{
                  accessibilityRole: "text",
                  accessibilityLabel: "OTP digit",
                  allowFontScaling: false,
                }}
                theme={{
                  containerStyle: styles.codeContainer,
                  pinCodeContainerStyle: styles.pinCodeContainer,
                  pinCodeTextStyle: styles.pinCodeText,
                  focusStickStyle: styles.focusStick,
                  focusedPinCodeContainerStyle: styles.activePinCodeContainer,
                  placeholderTextStyle: styles.placeholderText,
                  disabledPinCodeContainerStyle:
                    styles.disabledPinCodeContainer,
                }}
              />

              <Button
                disabled={(code.length >= 4 ? false : true) || isLoading}
                title="Confirm"
                isLoading={isLoading}
                onPress={handleLogin}
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
    borderColor: colors.border,
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
  codeContainer: {
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: 30,
  },
  pinCodeContainer: {
    backgroundColor: colors.background,
    borderCurve: "continuous",
    // width: 48,
    flex: 1,
    height: 48,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7E5E4",
  },
  activePinCodeContainer: {
    backgroundColor: colors.background,
    borderCurve: "continuous",
    // width: 48,
    flex: 1,
    height: 48,
    borderRadius: 13,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledPinCodeContainer: {
    opacity: 0.4,
  },
  pinCodeText: {
    // fontFamily: FONTS.Satoshi.Medium,
    color: colors.black,
    fontSize: 18,
  },
  focusStick: {
    backgroundColor: colors.black,
  },
  placeholderText: {
    color: colors.textSecondary,
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
