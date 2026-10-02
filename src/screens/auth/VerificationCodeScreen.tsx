import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/Button";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect } from "@react-navigation/native";
import { useNotify } from "@/components/notify";
import {
  OTP_LENGTH,
  sendOtpErrorMessage,
  useSendOtp,
  useVerifyOtp,
} from "@/services/auth.service";

type Props = NativeStackScreenProps<AuthStackParamList, "VerificationCode">;

const RESEND_DELAY_SECONDS = 30;

export const VerificationCodeScreen = ({ navigation, route }: Props) => {
  const { phone } = route.params;
  const insets = useSafeAreaInsets();
  const { notify } = useNotify();
  const verifyOtp = useVerifyOtp();
  const sendOtp = useSendOtp();

  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_DELAY_SECONDS);

  const otpInputRef = useRef<OtpInputRef>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // On success the session changes and the root navigator swaps to the
  // profile or app screens by itself: nothing to navigate to here
  const confirmOtp = (token: string) => {
    if (verifyOtp.isPending) return;

    verifyOtp.mutate(
      { phone, token },
      {
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          notify("Wrong code", {
            description: "Check the code and try again.",
          });
          // clear() empties the boxes without calling onTextChange
          otpInputRef.current?.clear();
          setCode("");
          otpInputRef.current?.focus();
        },
      },
    );
  };

  const handleResend = () => {
    sendOtp.mutate(phone, {
      onSuccess: () => setResendIn(RESEND_DELAY_SECONDS),
      onError: (error) =>
        notify("Code not sent", {
          description: sendOtpErrorMessage(error),
        }),
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 350);

      return () => {
        // clear the timeout set timeout
        clearTimeout(timer);
      };
    }, []),
  );

  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      keyboardVerticalOffset={-20}
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
                ref={otpInputRef}
                numberOfDigits={OTP_LENGTH}
                focusColor={colors.primary}
                autoFocus={true}
                hideStick={true}
                placeholder="000000"
                blurOnFilled={false}
                disabled={verifyOtp.isPending}
                type="numeric"
                secureTextEntry={false}
                focusStickBlinkingDuration={500}
                onTextChange={setCode}
                onFilled={confirmOtp}
                textInputProps={{
                  accessibilityLabel: "One-Time Password",
                  // The library marks its input as a one-time code; on iOS 27
                  // that input refuses focus, so nothing can be typed. iOS only
                  // autofills codes from SMS and Mail anyway, not WhatsApp.
                  textContentType: "none",
                  autoComplete: "off",
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
                disabled={code.length < OTP_LENGTH || verifyOtp.isPending}
                title="Confirm"
                isLoading={verifyOtp.isPending}
                onPress={() => confirmOtp(code)}
              />

              <Pressable
                onPress={handleResend}
                disabled={resendIn > 0 || sendOtp.isPending}
                hitSlop={12}
                style={styles.resend}
              >
                <Text
                  style={[
                    styles.resendText,
                    resendIn > 0 && { color: colors.textSecondary },
                  ]}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </Text>
              </Pressable>
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
  resend: {
    alignSelf: "center",
    marginTop: spacing.md,
  },
  resendText: {
    ...typography.body,
    color: colors.primary,
  },
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
