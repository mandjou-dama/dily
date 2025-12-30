import Button from "@/components/Button";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { AuthStackParamList } from "@/types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Camera, Mailbox, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  TextInput,
  Pressable,
  TextInputProps,
  Keyboard,
  Platform,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = NativeStackScreenProps<AuthStackParamList, "UserInfos">;

const UserInfosScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();

  const fullnameRef = useRef<any>(null);
  const emailRef = useRef<any>(null);

  const [image, setImage] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");

  const [focusedField, setFocusedField] = useState<"fullname" | "email" | null>(
    null
  );

  useEffect(() => {
    console.log("Focused field:", focusedField);
  }, [focusedField]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
        <TouchableWithoutFeedback onPress={() => KeyboardController.dismiss()}>
          <View style={styles.inner}>
            <View
              style={{
                height: "auto",
              }}
            >
              <Text style={styles.title}>
                Tell us more{" "}
                <Text
                  style={{
                    color: colors.primary,
                    textDecorationStyle: "solid",
                    textDecorationLine: "underline",
                  }}
                >
                  about your
                </Text>{" "}
                person
              </Text>

              <Pressable style={styles.imageContainer}>
                <Image
                  style={styles.image}
                  contentFit="cover"
                  source={require("assets/splash-icon-light.png")}
                />
                <View style={styles.imageOverlay}></View>

                <View style={styles.imageOverlayIcon}>
                  <Camera size={32} color={colors.white} />
                </View>
              </Pressable>

              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor:
                      focusedField === "fullname" ? colors.primary : "#E7E5E4",
                  },
                ]}
              >
                <User color={colors.primary} />
                <TextInput
                  ref={fullnameRef}
                  style={styles.input}
                  placeholder="Your fullname"
                  placeholderTextColor={colors.textSecondary}
                  value={fullname}
                  onChangeText={(value) => setFullname(value)}
                  onFocus={() => setFocusedField("fullname")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  keyboardType="name-phone-pad"
                  autoComplete="name"
                />
              </View>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor:
                      focusedField === "email" ? colors.primary : "#E7E5E4",
                  },
                ]}
              >
                <Mailbox color={colors.primary} />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Your email (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <Button title="Terminer" />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
};

export default UserInfosScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.black,
    textAlign: "left",
    marginBottom: spacing.xl,
  },
  imageContainer: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    borderCurve: "circular",
    borderRadius: "100%",
    // backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  image: {
    width: "90%",
    height: "90%",
    borderRadius: "100%",
    // filter: "invert(100%)",
  },
  imageOverlay: {
    position: "absolute",
    width: "95%",
    height: "95%",
    borderRadius: "100%",
    backgroundColor: "rgba(0, 0, 0, .6)",
    zIndex: 1,
  },
  imageOverlayIcon: {
    position: "absolute",
    width: "95%",
    height: "95%",
    borderRadius: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  inputContainer: {
    height: 48,
    borderWidth: 1,
    borderRadius: 13,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    fontSize: 14,
    color: colors.textPrimary,
    gap: spacing.md,
    marginBottom: 15,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
    // backgroundColor: "red",
    width: "80%",
    height: "100%",
  },
});
