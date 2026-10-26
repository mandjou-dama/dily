import Button from "@/components/Button";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { useImagePicker } from "@/hooks/use-image-picker";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { useNotify } from "@/components/notify";
import { apiErrorMessage } from "@/lib/api";
import { useUpdateProfile } from "@/services/auth.service";
import { Image } from "expo-image";
import { Camera, MapPin, User } from "lucide-react-native";
import React, { type ReactNode, useRef, useState } from "react";
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

type Props = {
  title: ReactNode;
  submitLabel: string;
  // Above the title: a back button when editing
  header?: ReactNode;
  initialFullName?: string;
  initialNeighbourhood?: string;
  // The avatar already saved, shown until a new photo is picked
  currentAvatarUri?: string | null;
  onSaved?: () => void;
};

/**
 * Name, neighbourhood and avatar: filled at sign-up, edited from the
 * profile. Saves through the API itself.
 */
export function ProfileForm({
  title,
  submitLabel,
  header,
  initialFullName = "",
  initialNeighbourhood = "",
  currentAvatarUri = null,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const { impact } = useHaptics();
  const { notify } = useNotify();
  const updateProfile = useUpdateProfile();
  const { imageUris, pickImages, isPicking } = useImagePicker();

  const neighbourhoodRef = useRef<TextInput>(null);

  const [fullname, setFullname] = useState(initialFullName);
  const [neighbourhood, setNeighbourhood] = useState(initialNeighbourhood);

  const avatarUri = imageUris[0] ?? currentAvatarUri;

  const handlePickImage = async () => {
    impact("light");
    await pickImages({ limit: 1 });
  };

  const handleSubmit = () => {
    updateProfile.mutate(
      {
        fullName: fullname,
        neighbourhood,
        avatarUri: imageUris[0],
      },
      {
        onSuccess: () => onSaved?.(),
        onError: (error) =>
          notify("Profile not saved", {
            description: apiErrorMessage(error, "Try again in a moment."),
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
          paddingTop: header ? insets.top : insets.top * 1.5,
          paddingBottom: insets.bottom,
        }}
      >
        <TouchableWithoutFeedback onPress={() => KeyboardController.dismiss()}>
          <View style={styles.inner}>
            <View style={styles.fields}>
              {header}
              <Text style={styles.title}>{title}</Text>

              <Pressable
                onPress={handlePickImage}
                style={styles.imageContainer}
                accessibilityRole="button"
                accessibilityLabel="Choose a profile photo"
              >
                <Image
                  source={
                    avatarUri
                      ? { uri: avatarUri }
                      : require("assets/splash-icon-light.png")
                  }
                  style={{ width: 110, height: 110, borderRadius: 55 }}
                  contentFit="cover"
                />

                {avatarUri ? (
                  // A photo is set: a small badge says it can be changed
                  <View style={styles.cameraBadge}>
                    <Camera size={16} color={colors.white} />
                  </View>
                ) : (
                  <>
                    <View style={styles.imageOverlay} />
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
                  </>
                )}
              </Pressable>

              <View style={styles.inputContainer}>
                <User color={colors.primary} />
                <TextInput
                  style={styles.input}
                  placeholder="Your fullname"
                  placeholderTextColor={colors.textSecondary}
                  value={fullname}
                  onChangeText={setFullname}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={80}
                  autoFocus={!initialFullName}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => neighbourhoodRef.current?.focus()}
                />
              </View>

              {/* Optional: buyers see it next to the seller's name */}
              <View style={styles.inputContainer}>
                <MapPin color={colors.primary} />
                <TextInput
                  ref={neighbourhoodRef}
                  style={styles.input}
                  placeholder="Your neighbourhood (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={neighbourhood}
                  onChangeText={setNeighbourhood}
                  autoCapitalize="words"
                  autoComplete="off"
                  textContentType="sublocality"
                  maxLength={60}
                  returnKeyType="done"
                />
              </View>
              <Text style={styles.hint}>
                Buyers see it on your listings, e.g. Hamdallaye ACI. City:
                Bamako.
              </Text>
            </View>

            <Button
              onPress={handleSubmit}
              isLoading={updateProfile.isPending}
              disabled={
                fullname.trim().length < MIN_NAME_LENGTH ||
                updateProfile.isPending
              }
              title={submitLabel}
            />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  fields: {
    alignSelf: "stretch",
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
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
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
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
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
    gap: spacing.md,
    marginBottom: 15,
  },
  hint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: -6,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
    width: "80%",
    height: "100%",
  },
});
