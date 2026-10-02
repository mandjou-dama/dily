import Button from "@/components/Button";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { useImagePicker } from "@/hooks/use-image-picker";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { useNotify } from "@/components/notify";
import { useUser } from "@/providers/auth-provider";
import { useUpdateProfile } from "@/services/auth.service";
import { Image } from "expo-image";
import { Camera, User } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MIN_NAME_LENGTH = 2;

const UserInfosScreen = () => {
  const insets = useSafeAreaInsets();
  const { impact } = useHaptics();
  const { notify } = useNotify();
  const user = useUser();
  const updateProfile = useUpdateProfile();
  const { imageUris, pickImages, isPicking } = useImagePicker();

  const fullnameRef = useRef<TextInput>(null);

  const [fullname, setFullname] = useState("");

  const handlePickImage = async () => {
    impact("light");
    const images = await pickImages({ limit: 1 });

    return images;
  };

  // Once the profile has a name, the root navigator swaps to the app
  const handleFinish = () => {
    updateProfile.mutate(
      { userId: user.id, fullName: fullname, avatarUri: imageUris[0] },
      {
        onError: (error) =>
          notify("Profile not saved", {
            description: error.message || "Try again in a moment.",
          }),
      },
    );
  };

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

              <Pressable
                onPress={handlePickImage}
                style={styles.imageContainer}
              >
                <Image
                  source={
                    imageUris.length > 0
                      ? { uri: imageUris[0] }
                      : require("assets/splash-icon-light.png")
                  }
                  style={{ width: 110, height: 110, borderRadius: 55 }}
                  contentFit="cover"
                />

                {imageUris.length <= 0 && (
                  <View style={styles.imageOverlay}></View>
                )}

                {imageUris.length <= 0 && (
                  <View style={styles.imageOverlayIcon}>
                    {isPicking ? (
                      <Spinner color={colors.white} />
                    ) : (
                      <Camera
                        style={{ pointerEvents: "none" }}
                        size={32}
                        color={colors.white}
                      />
                    )}
                  </View>
                )}
              </Pressable>

              <View style={styles.inputContainer}>
                <User color={colors.primary} />
                <TextInput
                  ref={fullnameRef}
                  style={styles.input}
                  placeholder="Your fullname"
                  placeholderTextColor={colors.textSecondary}
                  value={fullname}
                  onChangeText={setFullname}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={80}
                  autoFocus={true}
                />
              </View>
            </View>

            <Button
              onPress={handleFinish}
              isLoading={updateProfile.isPending}
              disabled={
                fullname.trim().length < MIN_NAME_LENGTH ||
                updateProfile.isPending
              }
              title="Terminer"
            />
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
    borderColor: "#E7E5E4",
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
