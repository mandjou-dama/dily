import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Image } from "expo-image";
import Button from "@/components/Button";
import { useNotify } from "@/components/notify";
import { useAuth } from "@/providers/auth-provider";
import { useSignOut } from "@/services/auth.service";

// Placeholder until phase 5: shows who is signed in and lets them sign out
export const ProfileScreen = () => {
  const { profile } = useAuth();
  const { notify } = useNotify();
  const signOut = useSignOut();

  // Signing out clears the session: the root navigator swaps to Auth
  const handleLogout = () => {
    signOut.mutate(undefined, {
      onError: (error) =>
        notify("Sign out failed", { description: error.message }),
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

      <Text style={styles.name}>{profile?.full_name}</Text>
      <Text style={styles.email}>+{profile?.phone}</Text>

      <View style={styles.footer}>
        <Button
          title="Sign out"
          onPress={handleLogout}
          isLoading={signOut.isPending}
          disabled={signOut.isPending}
        />
      </View>
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
    alignSelf: "stretch",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  logoutButton: {
    backgroundColor: colors.danger,
  },
});
