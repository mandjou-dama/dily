import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { Avatar } from "@/components/chat/avatar";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { Spinner } from "@/components/spinner";
import { useBlockUser } from "@/hooks/use-block-user";
import { firstName } from "@/lib/offers";
import {
  type BlockedUser,
  useBlockedUsers,
} from "@/services/moderation.service";
import { colors } from "@/theme/colors";

const AVATAR_SIZE = 44;

/** "Comptes bloqués": the people the user blocked, and the way to unblock them. */
export function BlockedUsersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { data: users, isPending, isError, refetch } = useBlockedUsers();

  const renderItem = useCallback(
    ({ item }: { item: BlockedUser }) => <BlockedRow user={item} />,
    [],
  );

  return (
    <View style={styles.screen}>
      <CheckoutHeader
        title={t("moderation.blockedAccounts")}
        onBack={navigation.goBack}
      />
      {users && users.length > 0 ? (
        <FlatList
          data={users}
          keyExtractor={(user) => user.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
        />
      ) : (
        <View style={styles.status}>
          {isPending ? (
            <Spinner color={colors.primary} size={28} />
          ) : isError ? (
            <>
              <Text style={styles.statusTitle}>
                {t("moderation.loadError")}
              </Text>
              <Pressable onPress={() => refetch()} hitSlop={12}>
                <Text style={styles.statusAction}>{t("common.retry")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.statusTitle}>
                {t("moderation.noBlocked")}
              </Text>
              <Text style={styles.statusText}>
                {t("moderation.noBlockedHint")}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const BlockedRow = ({ user }: { user: BlockedUser }) => {
  const { t } = useTranslation();
  const { unblock, isPending } = useBlockUser();
  const date = new Date(user.blockedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  return (
    <View style={styles.row}>
      <Avatar name={user.name} path={user.avatarPath} size={AVATAR_SIZE} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.date}>{t("moderation.blockedOn", { date })}</Text>
      </View>
      <ActionButton
        label={t("moderation.unblockShort")}
        variant="outline"
        onPress={() => unblock({ id: user.id, name: firstName(user.name) })}
        isLoading={isPending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  date: {
    fontSize: 13,
    color: colors.muted,
  },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
  },
  statusText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: "center",
  },
  statusAction: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
});
