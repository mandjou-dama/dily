import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList, RootStackParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps as StackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, "Profile">,
  StackScreenProps<RootStackParamList>
>;

export const ProfileScreen = ({ navigation }: Props) => {
  const user = {
    name: "John Doe",
    email: "john.doe@example.com",
    listingsCount: 12,
    rating: 4.9,
  };

  const handleLogout = () => {
    // Navigate to Auth stack
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "Auth" }],
    });
  };

  return (
    <View style={styles.container}>
      <Image
        style={{
          width: 100,
          aspectRatio: 1 / 1,
          marginTop: 80,
        }}
        source={require("assets/splash-icon-light.png")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.title,
    fontSize: 32,
    color: "#FFFFFF",
  },
  name: {
    ...typography.title,
    marginBottom: 4,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    ...typography.title,
    fontSize: 18,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
  menu: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuText: {
    ...typography.body,
    fontSize: 16,
  },
  footer: {
    marginTop: spacing.xl,
  },
  logoutButton: {
    backgroundColor: colors.danger,
  },
});
