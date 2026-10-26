import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type StaticScreenProps,
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Image } from "expo-image";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
} from "lucide-react-native";
import { MESSAGE_MAX_LENGTH } from "@dily/shared";

import { Avatar } from "@/components/chat/avatar";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import {
  chatDayLabel,
  formatPrice,
  isSameDay,
  messageTime,
} from "@/lib/format";
import { imageUrl } from "@/lib/image";
import { registerForPush, setOpenConversation } from "@/lib/push";
import { useAuth } from "@/providers/auth-provider";
import {
  type ChatMessage,
  type Conversation,
  type OutgoingMessage,
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
} from "@/services/chat.service";
import { colors } from "@/theme/colors";

// Static navigation reads the params type from here
type Props = StaticScreenProps<{ id: string }>;

type Row = ChatMessage | OutgoingMessage;

const PRODUCT_THUMB_SIZE = 40;
// What a buyer most often asks first
const FIRST_QUESTION = "Hi! Is this still available?";

const isOutgoing = (row: Row): row is OutgoingMessage => "status" in row;
const keyExtractor = (row: Row) => row.id;

export const ConversationScreen = ({ route }: Props) => {
  const { id } = route.params;
  const {
    data: conversation,
    isPending,
    isError,
    refetch,
  } = useConversation(id);

  // Its notifications don't pop up while it's on screen
  useFocusEffect(
    useCallback(() => {
      setOpenConversation(id);
      return () => setOpenConversation(null);
    }, [id]),
  );

  if (conversation) return <ConversationView conversation={conversation} />;

  return (
    <View style={styles.screen}>
      <TopBar>
        <View style={styles.flex} />
      </TopBar>
      <View style={styles.status}>
        {isPending ? (
          <Spinner color={colors.primary} size={28} />
        ) : isError ? (
          <>
            <Text style={styles.statusTitle}>
              {"Couldn't load this conversation"}
            </Text>
            <Pressable onPress={() => refetch()} hitSlop={12}>
              <Text style={styles.statusAction}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.statusTitle}>
            This conversation is no longer available
          </Text>
        )}
      </View>
    </View>
  );
};

const ConversationView = ({ conversation }: { conversation: Conversation }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptics();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { otherUser, product } = conversation;

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversation.id);
  const { outgoing, send, retry, discard } = useSendMessage(conversation.id);

  const saved = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  // Newest first; a sent message can reach the cache before its request returns
  const rows = useMemo<Row[]>(() => {
    const savedIds = new Set(saved.map((m) => m.id));
    return [...outgoing.filter((m) => !savedIds.has(m.id)), ...saved];
  }, [outgoing, saved]);

  // Read as they arrive while the screen is in front
  const isFocused = useIsFocused();
  const { mutate: markRead } = useMarkRead(conversation.id);
  const newestUnreadId = saved.find(
    (m) => m.senderId !== userId && !m.readAt,
  )?.id;
  const markedId = useRef<string | null>(null);
  useEffect(() => {
    if (!isFocused || !newestUnreadId) return;
    if (markedId.current === newestUnreadId) return;
    markedId.current = newestUnreadId;
    markRead();
  }, [isFocused, newestUnreadId, markRead]);
  useFocusEffect(
    useCallback(() => {
      // Coming back tries again, after a failure too
      markedId.current = null;
    }, []),
  );

  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;
  const onSend = () => {
    const body = text.trim();
    if (!body) return;
    impact("light");
    send(body);
    setText("");
    // Waiting for a reply: when being notified starts to matter
    void registerForPush(true);
  };

  const onFailedPress = useCallback(
    (message: OutgoingMessage) =>
      Alert.alert("Message not sent", "Check your connection.", [
        {
          text: "Delete",
          style: "destructive",
          onPress: () => discard(message.id),
        },
        { text: "Try again", onPress: () => retry(message) },
      ]),
    [discard, retry],
  );

  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      // Inverted: the row above on screen is the next, older one
      const older = rows[index + 1];
      const newDay = !older || !isSameDay(older.createdAt, item.createdAt);
      const grouped = !newDay && older?.senderId === item.senderId;
      return (
        <View style={grouped ? styles.rowGrouped : styles.row}>
          {newDay ? (
            <Text style={styles.day}>{chatDayLabel(item.createdAt)}</Text>
          ) : null}
          <Bubble
            message={item}
            mine={item.senderId === userId}
            onFailedPress={onFailedPress}
          />
        </View>
      );
    },
    [rows, userId, onFailedPress],
  );

  // The composer sits on the home indicator, then on the keyboard
  const { progress } = useReanimatedKeyboardAnimation();
  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      progress.get(),
      [0, 1],
      [Math.max(insets.bottom, 10), 10],
    ),
  }));

  const thumbUri = imageUrl(product.imagePath, PRODUCT_THUMB_SIZE * 3);
  const isBuyer = conversation.role === "buyer";

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <TopBar>
        <Avatar name={otherUser.name} path={otherUser.avatarPath} size={36} />
        <Text style={styles.headerName} numberOfLines={1}>
          {otherUser.name}
        </Text>
      </TopBar>

      <Pressable
        onPress={() =>
          navigation.navigate("ProductDetails", { id: product.id })
        }
        accessibilityRole="button"
        accessibilityHint="Opens the listing"
        style={({ pressed }) => [
          styles.productStrip,
          pressed && styles.pressed,
        ]}
      >
        {thumbUri ? (
          <Image
            source={thumbUri}
            style={styles.productThumb}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.productThumb} />
        )}
        <View style={styles.flex}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={styles.productPrice}>
            {formatPrice(product.price)} F CFA
            {product.status === "sold" ? " · Sold" : ""}
          </Text>
        </View>
      </Pressable>

      <FlatList
        inverted
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.olderSpinner}>
              <Spinner color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          isPending ? (
            <View style={styles.status}>
              <Spinner color={colors.primary} size={28} />
            </View>
          ) : isError ? (
            <View style={styles.status}>
              <Text style={styles.statusTitle}>
                {"Couldn't load the messages"}
              </Text>
              <Pressable onPress={() => refetch()} hitSlop={12}>
                <Text style={styles.statusAction}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                Say hello to {otherUser.name.split(" ")[0]}
              </Text>
              <Text style={styles.emptyText}>
                {isBuyer
                  ? "Ask about the item, agree on a price and where to meet."
                  : "They'll see your reply right away."}
              </Text>
              {isBuyer && product.status === "active" ? (
                <Pressable
                  onPress={() => setText(FIRST_QUESTION)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.suggestion,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.suggestionText}>{FIRST_QUESTION}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      <Animated.View style={[styles.composer, composerStyle]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.gray}
          multiline
          maxLength={MESSAGE_MAX_LENGTH}
          style={styles.input}
          accessibilityLabel="Message"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const Bubble = ({
  message,
  mine,
  onFailedPress,
}: {
  message: Row;
  mine: boolean;
  onFailedPress: (message: OutgoingMessage) => void;
}) => {
  const status = isOutgoing(message) ? message.status : null;
  const failed = status === "failed";
  const tint = mine ? "rgba(255, 255, 255, 0.75)" : colors.textSecondary;

  const content = (
    <View
      style={[
        styles.bubble,
        mine ? styles.bubbleMine : styles.bubbleTheirs,
        failed && styles.bubbleFailed,
      ]}
    >
      <Text
        selectable
        style={[styles.bubbleText, mine && styles.bubbleTextMine]}
      >
        {message.body}
      </Text>
      <View style={styles.bubbleMeta}>
        <Text style={[styles.bubbleTime, { color: tint }]}>
          {messageTime(message.createdAt)}
        </Text>
        {mine ? (
          status === "sending" ? (
            <Clock size={12} color={tint} strokeWidth={2} />
          ) : failed ? (
            <CircleAlert size={13} color={colors.white} strokeWidth={2.2} />
          ) : message.readAt ? (
            <CheckCheck
              size={14}
              color={colors.white}
              strokeWidth={2.2}
              accessibilityLabel="Read"
            />
          ) : (
            <Check
              size={14}
              color={tint}
              strokeWidth={2.2}
              accessibilityLabel="Sent"
            />
          )
        ) : null}
      </View>
    </View>
  );

  if (!failed || !isOutgoing(message)) return content;
  return (
    <Pressable
      onPress={() => onFailedPress(message)}
      accessibilityRole="button"
      accessibilityHint="Not sent. Opens the options to try again."
      style={styles.failedWrap}
    >
      {content}
      <Text style={styles.failedText}>Not sent · Tap to retry</Text>
    </Pressable>
  );
};

const TopBar = ({ children }: { children: React.ReactNode }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ArrowLeft size={22} color={colors.primary} strokeWidth={1.8} />
      </Pressable>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  headerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
  },
  productStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 8,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  productThumb: {
    width: PRODUCT_THUMB_SIZE,
    height: PRODUCT_THUMB_SIZE,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "#EAE7DC",
  },
  productTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
  },
  productPrice: {
    fontSize: 13,
    color: "#5A5A52",
    fontVariant: ["tabular-nums"],
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  olderSpinner: {
    paddingVertical: 12,
    alignItems: "center",
  },
  row: {
    marginTop: 10,
  },
  rowGrouped: {
    marginTop: 3,
  },
  day: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#5A5A52",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
  },
  bubbleFailed: {
    backgroundColor: colors.danger,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 21,
    color: colors.black,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  bubbleTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  failedWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  failedText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2DED2",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: "#B9BCA9",
  },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
  },
  statusAction: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  suggestion: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
