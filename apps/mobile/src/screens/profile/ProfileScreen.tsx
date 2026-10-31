import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { Ellipsis, MapPin, Pencil, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { colorKit } from "reanimated-color-picker";

import {
  GridError,
  GridLoading,
  GridMessage,
} from "@/components/product-grid-states";
import { TOP_TABS_HEIGHT, TopTabs } from "@/components/top-tab";
import { useNotify } from "@/components/notify";
import { productKeyExtractor, useProductGrid } from "@/hooks/use-product-grid";
import { showActionMenu } from "@/lib/action-menu";
import { openSupportChat } from "@/lib/support";
import { apiErrorMessage } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { imageUrl } from "@/lib/image";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteAccount, useSignOut } from "@/services/auth.service";
import {
  type FeedProduct,
  useFavorites,
  useMyListings,
} from "@/services/products.service";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

const TABS = ["Listings", "Favorites"] as const;
type Tab = (typeof TABS)[number];

const AVATAR_SIZE = 88;
// 88pt at up to 3x density
const AVATAR_WIDTH = 400;

// One list for the whole screen, like the home feed
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as typeof FlashList<FeedProduct>;

const EMPTY_MESSAGES: Record<Tab, { title: string; text: string }> = {
  Listings: {
    title: "No listings yet",
    text: "What you sell from the Sell tab shows up here.",
  },
  Favorites: {
    title: "No favorites yet",
    text: "Tap the heart on a listing to keep it here.",
  },
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const { profile } = useAuth();
  const { notify } = useNotify();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();

  const listRef = useRef<FlashListRef<FeedProduct>>(null);
  useScrollToTop(listRef);

  const [tab, setTab] = useState<Tab>("Listings");
  const tabIndex = useSharedValue(0);
  const scrollY = useSharedValue(0);
  // Measured: the name and location make the header's height vary
  const identityHeight = useSharedValue(0);

  // Both stay loaded, so switching tabs is instant
  const listings = useMyListings();
  const favorites = useFavorites();
  const feed = tab === "Listings" ? listings : favorites;
  const { data, renderItem, loadMore, refetchLikes } = useProductGrid(feed);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refetch: refetchListings } = listings;
  const { refetch: refetchFavorites } = favorites;
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchListings(), refetchFavorites(), refetchLikes()]);
    setIsRefreshing(false);
  }, [refetchListings, refetchFavorites, refetchLikes]);

  const selectTab = useCallback(
    (name: string) => {
      const index = TABS.indexOf(name as Tab);
      if (index === -1) return;
      tabIndex.set(withTiming(index, { duration: 250 }));
      setTab(name as Tab);
    },
    [tabIndex],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // The tabs ride up with the identity block, then stick under the top bar
  const pinnedTabsStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.max(0, identityHeight.get() - scrollY.get()) },
    ],
  }));

  // Signing out or deleting clears the session: the root navigator swaps to Auth
  const confirmSignOut = () =>
    signOut.mutate(undefined, {
      onError: (error) =>
        notify("Sign out failed", {
          description: apiErrorMessage(error, "Try again in a moment."),
        }),
    });

  const confirmDeleteAccount = () =>
    Alert.alert(
      "Delete your account?",
      "Your listings, photos and favorites are deleted for good. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onError: (error) =>
                notify("Account not deleted", {
                  description: apiErrorMessage(
                    error,
                    "Check your connection and try again.",
                  ),
                }),
            }),
        },
      ],
    );

  const onMore = () =>
    showActionMenu(
      "Account",
      [
        {
          label: t("moderation.blockedAccounts"),
          onPress: () => navigation.navigate("BlockedUsers"),
        },
        { label: "Sign out", onPress: confirmSignOut },
        {
          label: "Delete account",
          destructive: true,
          onPress: confirmDeleteAccount,
        },
      ],
      "Cancel",
    );

  const name = profile?.fullName ?? "";
  const location = [profile?.neighbourhood, profile?.city]
    .filter(Boolean)
    .join(", ");
  const avatarUri = imageUrl(profile?.avatarPath, AVATAR_WIDTH);

  const listHeader = useMemo(
    () => (
      <View>
        <View
          style={styles.identity}
          onLayout={(event) =>
            identityHeight.set(event.nativeEvent.layout.height)
          }
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarInitial]}>
              <Text style={styles.avatarInitialText}>{name.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          {location ? (
            <View style={styles.location}>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={styles.secondary}>{location}</Text>
            </View>
          ) : null}
          {profile ? (
            <Text style={styles.secondary}>{formatPhone(profile.phone)}</Text>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate("EditProfile")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
          >
            <Pencil size={16} color={colors.primary} strokeWidth={1.8} />
            <Text style={styles.editText}>Edit profile</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("PayoutAccount")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.editButton,
              styles.payoutButton,
              pressed && styles.pressed,
            ]}
          >
            <Wallet size={16} color={colors.primary} strokeWidth={1.8} />
            <Text style={styles.editText}>
              {profile?.payoutAccount
                ? t("payout.profileEntry")
                : t("payout.profileNone")}
            </Text>
          </Pressable>
          <View style={styles.links}>
            <Pressable
              onPress={openSupportChat}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.link}>{t("support.help")}</Text>
            </Pressable>
            <Text style={styles.linkSeparator}>·</Text>
            <Pressable
              onPress={() => navigation.navigate("Terms")}
              hitSlop={8}
              accessibilityRole="link"
            >
              <Text style={styles.link}>{t("support.terms")}</Text>
            </Pressable>
          </View>
        </View>
        {/* Room for the pinned tab bar drawn above the list */}
        <View style={styles.tabsSpacer} />
      </View>
    ),
    [avatarUri, identityHeight, location, name, navigation, profile, t],
  );

  const empty = EMPTY_MESSAGES[tab];

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topTitle}>Profile</Text>
        <Pressable
          onPress={onMore}
          hitSlop={12}
          disabled={signOut.isPending || deleteAccount.isPending}
          accessibilityRole="button"
          accessibilityLabel="Account options"
        >
          <Ellipsis size={22} color={colors.primary} strokeWidth={1.5} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <AnimatedFlashList
          ref={listRef}
          data={data}
          numColumns={2}
          keyExtractor={productKeyExtractor}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            feed.isPending ? (
              <GridLoading />
            ) : feed.isError ? (
              <GridError onRetry={feed.refetch} />
            ) : (
              <GridMessage title={empty.title} text={empty.text} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{
            paddingHorizontal: 6,
            paddingBottom: tabBarHeight + 16,
          }}
        />

        <Animated.View style={[styles.pinnedTabs, pinnedTabsStyle]}>
          <TopTabs
            tabNames={TABS}
            indexDecimal={tabIndex}
            onTabPress={selectTab}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 0.8,
    borderBottomColor: colorKit.setAlpha("#3C5627", 0.07).hex(),
    zIndex: 50,
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.primary,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  identity: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    gap: 4,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginBottom: 8,
    backgroundColor: "#EAE7DC",
  },
  avatarInitial: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFE3D2",
  },
  avatarInitialText: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.primary,
  },
  name: {
    ...typography.title,
    fontSize: 24,
    color: colors.black,
    textAlign: "center",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secondary: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  payoutButton: {
    marginTop: 8,
  },
  // Dily's contact and the terms (App Store guideline 1.2)
  links: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  link: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    textDecorationLine: "underline",
  },
  linkSeparator: {
    fontSize: 13,
    color: colors.muted,
  },
  editButton: {
    marginTop: 14,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 13,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  tabsSpacer: {
    height: TOP_TABS_HEIGHT + 6,
  },
  pinnedTabs: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
  },
});
