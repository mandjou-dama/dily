import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useNotify } from "@/components/notify";
import { ProfileForm } from "@/components/profile/profile-form";
import { useHaptics } from "@/hooks/use-haptics";
import { imageUrl } from "@/lib/image";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

// Shown at 110pt: 400px covers any density
const AVATAR_WIDTH = 400;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { notify } = useNotify();
  const { notification } = useHaptics();

  return (
    <ProfileForm
      header={
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
        >
          <ArrowLeft size={22} color={colors.black} strokeWidth={1.8} />
        </Pressable>
      }
      title="Edit your profile"
      submitLabel="Save changes"
      initialFullName={profile?.fullName ?? ""}
      initialNeighbourhood={profile?.neighbourhood ?? ""}
      currentAvatarUri={imageUrl(profile?.avatarPath, AVATAR_WIDTH)}
      onSaved={() => {
        notification("success");
        notify("Profile saved");
        navigation.goBack();
      }}
    />
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
});
