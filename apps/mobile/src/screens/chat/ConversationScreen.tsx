import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Platform,
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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import {
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  Clock,
  ShieldCheck,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { MESSAGE_MAX_LENGTH, type Offer } from "@dily/shared";

import { DealHeader } from "@/components/offers/deal-header";
import { DealMessage } from "@/components/offers/deal-message";
import { OfferMessage } from "@/components/offers/offer-message";
import {
  OfferSheet,
  type OfferSheetRef,
} from "@/components/offers/offer-sheet";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { chatDayLabel, messageMeta } from "@/lib/chat-labels";
import { isSameDay, messageTime } from "@/lib/format";
import { dealErrorMessage, firstName } from "@/lib/offers";
import { registerForPush, setOpenConversation } from "@/lib/push";
import { useAuth } from "@/providers/auth-provider";
import {
  type ChatMessage,
  type Conversation,
  conversationQueryKey,
  messagesQueryKey,
  type OutgoingMessage,
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
} from "@/services/chat.service";
import { useAnswerOffer } from "@/services/offers.service";
import { colors } from "@/theme/colors";

// Static navigation reads the params type from here. `makeOffer`: back
// from the payment steps to change an agreed way of getting the item
type Props = StaticScreenProps<{ id: string; makeOffer?: boolean }>;

type Row = ChatMessage | OutgoingMessage;

// Between the composer and the keyboard, or the screen's edge
const COMPOSER_GAP = 10;

const isOutgoing = (row: Row): row is OutgoingMessage => "status" in row;
const keyExtractor = (row: Row) => row.id;
// Android only: iOS gains little and can blank rows while scrolling fast
const REMOVE_CLIPPED_SUBVIEWS = Platform.OS === "android";

export const ConversationScreen = ({ route }: Props) => {
  const { id, makeOffer } = route.params;
  const {
    data: conversation,
    isPending,
    isError,
    refetch,
  } = useConversation(id);
  const { t } = useTranslation();

  // Its notifications don't pop up while it's on screen
  useFocusEffect(
    useCallback(() => {
      setOpenConversation(id);
      return () => setOpenConversation(null);
    }, [id]),
  );

  if (conversation) {
    return (
      <ConversationView conversation={conversation} makeOffer={makeOffer} />
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar />
      <View style={styles.status}>
        {isPending ? (
          <Spinner color={colors.primary} size={28} />
        ) : isError ? (
          <>
            <Text style={styles.statusTitle}>{t("chat.loadError")}</Text>
            <Pressable onPress={() => refetch()} hitSlop={12}>
              <Text style={styles.statusAction}>{t("common.retry")}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.statusTitle}>{t("chat.gone")}</Text>
        )}
      </View>
    </View>
  );
};

const ConversationView = ({
  conversation,
  makeOffer,
}: {
  conversation: Conversation;
  makeOffer?: boolean;
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { impact, notification } = useHaptics();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const { otherUser, product, deal } = conversation;
  const isBuyer = conversation.role === "buyer";
  const otherName = firstName(otherUser.name);
  // Pickup happens at the seller's
  const pickupArea = isBuyer
    ? (otherUser.location.split(",")[0] ?? otherUser.location)
    : (profile?.neighbourhood ?? profile?.city ?? "");

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
  // Newest first: the order of an inverted list; a sent message can reach
  // the cache before its request returns
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
      Alert.alert(t("chat.notSentTitle"), t("chat.notSentBody"), [
        {
          text: t("chat.delete"),
          style: "destructive",
          onPress: () => discard(message.id),
        },
        { text: t("common.retry"), onPress: () => retry(message) },
      ]),
    [discard, retry, t],
  );

  // The offer sheet: a new offer, or a counter-offer to `answering`. The
  // chat's keyboard goes down first, then the sheet rises: one movement at
  // a time, never the sheet settling on a keyboard that's leaving
  const offerSheet = useRef<OfferSheetRef>(null);
  const opening = useRef(false);
  const openSheet = useCallback(async (answering: Offer | null) => {
    if (opening.current) return;
    opening.current = true;
    try {
      await KeyboardController.dismiss();
      offerSheet.current?.open(answering);
    } finally {
      opening.current = false;
    }
  }, []);

  const pendingFromThem =
    deal.offer?.status === "pending" && deal.offer.authorId !== userId
      ? deal.offer
      : null;
  const onMakeOffer = useCallback(
    () => openSheet(pendingFromThem),
    [openSheet, pendingFromThem],
  );

  // Asked from the payment steps: the sheet rises once this screen is back
  useEffect(() => {
    if (!makeOffer) return;
    return navigation.addListener("transitionEnd", (event) => {
      if (event.data.closing) return;
      navigation.setParams({ makeOffer: undefined });
      void onMakeOffer();
    });
  }, [makeOffer, navigation, onMakeOffer]);

  // "Acheter" and "Payer": the payment steps, which read the deal
  const onCheckout = useCallback(() => {
    void KeyboardController.dismiss();
    navigation.navigate("Checkout", { conversationId: conversation.id });
  }, [navigation, conversation.id]);

  const refreshDeal = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: conversationQueryKey(conversation.id),
    });
    queryClient.invalidateQueries({
      queryKey: messagesQueryKey(conversation.id),
    });
  }, [queryClient, conversation.id]);

  const {
    mutate: answerOffer,
    isPending: isAnswering,
    variables: answerVariables,
  } = useAnswerOffer();
  const answeringId = isAnswering ? answerVariables?.offerId : undefined;
  const answer = useCallback(
    (offer: Offer, verb: "accept" | "decline") => {
      impact("light");
      answerOffer(
        { offerId: offer.id, answer: verb },
        {
          onSuccess: () => notification("success"),
          onError: (error) => {
            notification("error");
            Alert.alert(dealErrorMessage(error));
            refreshDeal();
          },
        },
      );
    },
    [answerOffer, impact, notification, refreshDeal],
  );
  const onAccept = useCallback(
    (offer: Offer) => answer(offer, "accept"),
    [answer],
  );
  const onDecline = useCallback(
    (offer: Offer) => answer(offer, "decline"),
    [answer],
  );
  const onCounter = useCallback(
    (offer: Offer) => openSheet(offer),
    [openSheet],
  );

  const loadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      // Inverted: the row above on screen is the next, older one
      const older = rows[index + 1];
      const newDay = !older || !isSameDay(older.createdAt, item.createdAt);
      const grouped =
        !newDay &&
        older?.senderId === item.senderId &&
        older.kind === "text" &&
        item.kind === "text";
      return (
        <MessageRow
          row={item}
          newDay={newDay}
          grouped={grouped}
          mine={item.senderId === userId}
          offerMine={item.offer?.authorId === userId}
          role={conversation.role}
          otherName={otherName}
          pickupArea={pickupArea}
          answering={!!item.offer && item.offer.id === answeringId}
          onFailedPress={onFailedPress}
          onAccept={onAccept}
          onCounter={onCounter}
          onDecline={onDecline}
          onPay={onCheckout}
        />
      );
    },
    [
      rows,
      userId,
      conversation.role,
      otherName,
      pickupArea,
      answeringId,
      onFailedPress,
      onAccept,
      onCounter,
      onDecline,
      onCheckout,
    ],
  );

  // The composer sits on the home indicator, then COMPOSER_GAP above the
  // keyboard: the chat moves up by the keyboard minus what the home
  // indicator already took
  const keyboardOffset = -Math.max(insets.bottom - COMPOSER_GAP, 0);

  // Before any offer or agreement: where paying safely starts
  const showSafetyNote =
    isBuyer && product.status === "active" && !deal.offer && !deal.order;

  return (
    <View style={styles.screen}>
      {/* Above the chat, which slides under it while the keyboard moves */}
      <View style={styles.top}>
        <TopBar>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUser.name}
          </Text>
          {otherUser.location ? (
            <Text style={styles.headerLocation} numberOfLines={1}>
              {otherUser.location}
            </Text>
          ) : null}
        </TopBar>

        <DealHeader
          conversation={conversation}
          userId={userId}
          onOpenProduct={() =>
            navigation.navigate("ProductDetails", { id: product.id })
          }
          onMakeOffer={onMakeOffer}
          onBuy={onCheckout}
          onPay={onCheckout}
        />
      </View>

      {/* Moved with transforms while the keyboard moves, laid out once at
          the end: smooth on modest phones. Always on, the sheet's keyboard
          included: switched off mid-move, it would stay where it was */}
      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={keyboardOffset}
        style={styles.flex}
      >
        {rows.length > 0 ? (
          <FlatList
            inverted
            data={rows}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={11}
            removeClippedSubviews={REMOVE_CLIPPED_SUBVIEWS}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Inverted: the header sits at the bottom, the footer at the top
            ListHeaderComponent={showSafetyNote ? <SafetyNote /> : null}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.olderSpinner}>
                  <Spinner color={colors.primary} />
                </View>
              ) : null
            }
          />
        ) : (
          <View style={styles.status}>
            {isPending ? (
              <Spinner color={colors.primary} size={28} />
            ) : isError ? (
              <>
                <Text style={styles.statusTitle}>
                  {t("chat.messagesError")}
                </Text>
                <Pressable onPress={() => refetch()} hitSlop={12}>
                  <Text style={styles.statusAction}>{t("common.retry")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {t("chat.sayHello", { name: otherName })}
                </Text>
                <Text style={styles.emptyText}>
                  {isBuyer ? t("chat.buyerHint") : t("chat.sellerHint")}
                </Text>
                {isBuyer && product.status === "active" ? (
                  <Pressable
                    onPress={() => setText(t("chat.firstQuestion"))}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.suggestion,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.suggestionText}>
                      {t("chat.firstQuestion")}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, COMPOSER_GAP) },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={colors.gray}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
            style={styles.input}
            accessibilityLabel={t("chat.message")}
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <OfferSheet ref={offerSheet} conversation={conversation} />
    </View>
  );
};

/** Before any offer: the price is discussed here, and paid safely in Dily. */
const SafetyNote = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.safetyNote}>
      <ShieldCheck size={20} color={colors.primary} strokeWidth={2} />
      <Text style={styles.safetyText}>{t("deal.safetyNote")}</Text>
    </View>
  );
};

type MessageRowProps = {
  row: Row;
  newDay: boolean;
  grouped: boolean;
  mine: boolean;
  offerMine: boolean;
  role: Conversation["role"];
  otherName: string;
  pickupArea: string;
  answering: boolean;
  onFailedPress: (message: OutgoingMessage) => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onDecline: (offer: Offer) => void;
  onPay: () => void;
};

/** One row of the conversation: a day label when the day changes, then the message. */
const MessageRow = memo(function MessageRow({
  row,
  newDay,
  grouped,
  mine,
  offerMine,
  role,
  otherName,
  pickupArea,
  answering,
  onFailedPress,
  onAccept,
  onCounter,
  onDecline,
  onPay,
}: MessageRowProps) {
  let content: React.ReactNode;
  if (row.kind === "offer" && row.offer) {
    content = (
      <OfferMessage
        offer={row.offer}
        createdAt={row.createdAt}
        read={!!row.readAt}
        mine={offerMine}
        role={role}
        otherName={otherName}
        pickupArea={pickupArea}
        answering={answering}
        onAccept={onAccept}
        onCounter={onCounter}
        onDecline={onDecline}
      />
    );
  } else if (row.kind === "deal" && row.order) {
    content = (
      <DealMessage
        order={row.order}
        role={role}
        otherName={otherName}
        onPay={onPay}
      />
    );
  } else {
    content = (
      <Bubble message={row} mine={mine} onFailedPress={onFailedPress} />
    );
  }
  return (
    <View style={grouped ? styles.rowGrouped : styles.row}>
      {newDay ? (
        <Text style={styles.day}>{chatDayLabel(row.createdAt)}</Text>
      ) : null}
      {content}
    </View>
  );
});

const Bubble = ({
  message,
  mine,
  onFailedPress,
}: {
  message: Row;
  mine: boolean;
  onFailedPress: (message: OutgoingMessage) => void;
}) => {
  const { t } = useTranslation();
  const status = isOutgoing(message) ? message.status : null;
  const failed = status === "failed";

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
        {status === "sending" ? (
          <Clock size={11} color={colors.success} strokeWidth={2} />
        ) : failed ? (
          <CircleAlert size={12} color={colors.white} strokeWidth={2.2} />
        ) : null}
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
          {messageMeta(
            messageTime(message.createdAt),
            mine && !status && !!message.readAt,
          )}
        </Text>
      </View>
    </View>
  );

  if (!failed || !isOutgoing(message)) return content;
  return (
    <Pressable
      onPress={() => onFailedPress(message)}
      accessibilityRole="button"
      accessibilityHint={t("chat.notSentHint")}
      style={styles.failedWrap}
    >
      {content}
      <Text style={styles.failedText}>{t("chat.notSent")}</Text>
    </Pressable>
  );
};

/** Back, then the other person's name and neighbourhood, centered. */
const TopBar = ({ children }: { children?: React.ReactNode }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("chat.back")}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <ArrowLeft size={22} color={colors.primary} strokeWidth={1.8} />
      </Pressable>
      <View style={styles.headerCenter}>{children}</View>
      <View style={styles.headerSpacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  top: {
    zIndex: 1,
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  // Balances the back button: the name stays centered
  headerSpacer: {
    width: 44,
    height: 44,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
  },
  headerLocation: {
    fontSize: 12,
    color: colors.muted,
  },
  safetyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.note,
  },
  safetyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: colors.noteText,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
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
    color: colors.muted,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  // The corner on the sender's side is the bubble's tail
  bubbleMine: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
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
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  bubbleTimeMine: {
    color: colors.success,
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
