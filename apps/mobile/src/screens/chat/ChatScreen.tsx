import React, { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { colorKit } from "reanimated-color-picker";

import { Avatar } from "@/components/chat/avatar";
import { GridMessage } from "@/components/product-grid-states";
import { Spinner } from "@/components/spinner";
import { chatListTime } from "@/lib/format";
import { imageUrl } from "@/lib/image";
import { useAuth } from "@/providers/auth-provider";
import {
  type Conversation,
  primeConversation,
  useConversations,
} from "@/services/chat.service";
import { colors } from "@/theme/colors";

const AVATAR_SIZE = 52;
const THUMB_SIZE = 24;

const keyExtractor = (conversation: Conversation) => conversation.id;

export const ChatScreen = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  const listRef = useRef<FlashListRef<Conversation>>(null);
  useScrollToTop(listRef);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations();
  const conversations = data?.pages.flatMap((page) => page.items) ?? [];

  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow
        conversation={item}
        isMine={item.lastMessage?.senderId === userId}
        onPress={() => {
          primeConversation(queryClient, item);
          navigation.navigate("Conversation", { id: item.id });
        }}
      />
    ),
    [navigation, queryClient, userId],
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topTitle}>Chat</Text>
      </View>

      <FlashList
        ref={listRef}
        data={conversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isPending ? (
            <View style={styles.loading}>
              <Spinner color={colors.primary} size={28} />
            </View>
          ) : isError ? (
            <GridMessage
              title={"Couldn't load your messages"}
              text="Check your connection and try again."
              onRetry={refetch}
            />
          ) : (
            <GridMessage
              title="No messages yet"
              text="Found something you like? Message the seller from the listing."
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <Spinner color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
      />
    </View>
  );
};

const ConversationRow = ({
  conversation,
  isMine,
  onPress,
}: {
  conversation: Conversation;
  isMine: boolean;
  onPress: () => void;
}) => {
  const { otherUser, product, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;
  const thumbUri = imageUrl(product.imagePath, THUMB_SIZE * 3);
  const preview = lastMessage
    ? `${isMine ? "You: " : ""}${lastMessage.body}`
    : "";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${otherUser.name}, ${product.title}${
        unread ? `, ${unreadCount} unread` : ""
      }`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View>
        <Avatar
          name={otherUser.name}
          path={otherUser.avatarPath}
          size={AVATAR_SIZE}
        />
        {thumbUri ? (
          <Image
            source={thumbUri}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={thumbUri}
          />
        ) : null}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowLine}>
          <Text style={styles.name} numberOfLines={1}>
            {otherUser.name}
          </Text>
          {lastMessage ? (
            <Text style={[styles.time, unread && styles.timeUnread]}>
              {chatListTime(lastMessage.createdAt)}
            </Text>
          ) : null}
        </View>
        <Text style={styles.productTitle} numberOfLines={1}>
          {product.status === "sold" ? "Sold · " : ""}
          {product.title}
        </Text>
        <View style={styles.rowLine}>
          <Text
            style={[styles.preview, unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 0.8,
    borderBottomColor: colorKit.setAlpha("#3C5627", 0.07).hex(),
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.primary,
  },
  loading: {
    paddingTop: 64,
    alignItems: "center",
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colorKit.setAlpha("#3C5627", 0.05).hex(),
  },
  thumb: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 7,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: "#EAE7DC",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
  },
  time: {
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: "600",
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#5A5A52",
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.black,
    fontWeight: "500",
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
});
