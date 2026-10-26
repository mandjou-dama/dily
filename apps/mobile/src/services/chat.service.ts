import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ChatMessage,
  chatMessageSchema,
  type Conversation,
  conversationPageSchema,
  type ConversationReadEvent,
  conversationSchema,
  type MessagePage,
  messagePageSchema,
  unreadCountSchema,
} from "@dily/shared";
import { randomUUID } from "expo-crypto";
import { useState } from "react";

import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export type { ChatMessage, Conversation };

/** A message the app is sending, or failed to send: not in the API's history yet. */
export type OutgoingMessage = ChatMessage & { status: "sending" | "failed" };

export const CHAT_QUERY_KEY = ["chat"];
export const conversationsQueryKey = (userId: string | undefined) => [
  ...CHAT_QUERY_KEY,
  "conversations",
  userId,
];
export const unreadCountQueryKey = (userId: string | undefined) => [
  ...CHAT_QUERY_KEY,
  "unread",
  userId,
];
export const conversationQueryKey = (id: string) => [
  ...CHAT_QUERY_KEY,
  "conversation",
  id,
];
export const messagesQueryKey = (id: string) => [
  ...CHAT_QUERY_KEY,
  "messages",
  id,
];
export const orderQueryKey = (id: string) => [...CHAT_QUERY_KEY, "order", id];

const withCursor = (path: string, cursor: string | null) =>
  cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;

/** The user's conversations, latest message first. */
export function useConversations() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useInfiniteQuery({
    queryKey: conversationsQueryKey(userId),
    enabled: !!userId,
    queryFn: ({ pageParam }) =>
      api.request(withCursor("/conversations", pageParam), {
        schema: conversationPageSchema,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** Unread messages across all conversations: the Chat tab's badge. */
export function useUnreadCount() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: unreadCountQueryKey(userId),
    enabled: !!userId,
    queryFn: async () =>
      (
        await api.request("/conversations/unread-count", {
          schema: unreadCountSchema,
        })
      ).count,
  });
}

/** One conversation, or null when it no longer exists (account or listing deleted). */
export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationQueryKey(id),
    queryFn: async (): Promise<Conversation | null> => {
      try {
        return await api.request(`/conversations/${id}`, {
          schema: conversationSchema,
        });
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "not_found") {
          return null;
        }
        throw error;
      }
    },
  });
}

/** A conversation's history, newest first: the order of an inverted list. */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messagesQueryKey(conversationId),
    queryFn: ({ pageParam }) =>
      api.request(
        withCursor(`/conversations/${conversationId}/messages`, pageParam),
        { schema: messagePageSchema },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** "Message the seller": the conversation about this listing, started if needed. */
export function useOpenConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) =>
      api.request("/conversations", {
        method: "POST",
        body: { productId },
        schema: conversationSchema,
      }),
    onSuccess: (conversation) =>
      queryClient.setQueryData(
        conversationQueryKey(conversation.id),
        conversation,
      ),
  });
}

/**
 * Sending with an optimistic bubble. The id is generated here, so a retry
 * after a network error never duplicates the message. Pending and failed
 * messages live outside the query cache: a refetch can't drop them.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);

  const setStatus = (id: string, status: OutgoingMessage["status"]) =>
    setOutgoing((list) =>
      list.map((m) => (m.id === id ? { ...m, status } : m)),
    );

  const { mutate } = useMutation({
    mutationFn: (message: OutgoingMessage) =>
      api.request(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { id: message.id, body: message.body },
        schema: chatMessageSchema,
      }),
    onSuccess: (saved) => {
      addMessageToCache(queryClient, saved);
      setOutgoing((list) => list.filter((m) => m.id !== saved.id));
      queryClient.invalidateQueries({
        queryKey: conversationsQueryKey(session?.user.id),
      });
    },
    onError: (_error, message) => setStatus(message.id, "failed"),
  });

  const send = (body: string) => {
    if (!session) return;
    const message: OutgoingMessage = {
      id: randomUUID(),
      conversationId,
      senderId: session.user.id,
      kind: "text",
      body,
      offer: null,
      order: null,
      createdAt: new Date().toISOString(),
      readAt: null,
      status: "sending",
    };
    setOutgoing((list) => [message, ...list]);
    mutate(message);
  };

  const retry = (message: OutgoingMessage) => {
    setStatus(message.id, "sending");
    mutate({ ...message, status: "sending" });
  };

  const discard = (id: string) =>
    setOutgoing((list) => list.filter((m) => m.id !== id));

  return { outgoing, send, retry, discard };
}

/** Marks the other person's messages read; the badge and the list follow. */
export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: () =>
      api.request(`/conversations/${conversationId}/read`, { method: "POST" }),
    onSuccess: () => {
      if (!userId) return;
      // The API answers without the time; the socket event brings the exact one
      applyReadToCache(queryClient, {
        conversationId,
        readerId: userId,
        readAt: new Date().toISOString(),
      });
      refreshChatSummaries(queryClient, userId);
    },
  });
}

// Cache updates shared by the screens and the realtime events

/** Puts a message in its conversation's loaded history, replacing an older copy. */
export function addMessageToCache(
  queryClient: QueryClient,
  message: ChatMessage,
) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    messagesQueryKey(message.conversationId),
    (data) => {
      if (!data) return data;
      const known = data.pages.some((page) =>
        page.items.some((m) => m.id === message.id),
      );
      if (known) {
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((m) => (m.id === message.id ? message : m)),
          })),
        };
      }
      const [first, ...rest] = data.pages;
      if (!first) return data;
      return {
        ...data,
        pages: [{ ...first, items: [message, ...first.items] }, ...rest],
      };
    },
  );
}

/** The reader's counterpart's messages, up to `readAt`, are now read. */
export function applyReadToCache(
  queryClient: QueryClient,
  { conversationId, readerId, readAt }: ConversationReadEvent,
) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    messagesQueryKey(conversationId),
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((m) =>
            m.senderId !== readerId && !m.readAt && m.createdAt <= readAt
              ? { ...m, readAt }
              : m,
          ),
        })),
      },
  );
}

/** Last messages, unread counts and the tab badge, read again from the API. */
export function refreshChatSummaries(queryClient: QueryClient, userId: string) {
  queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId) });
  queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
}

/** Seeds the conversation screen from the list, so its header shows at once. */
export const primeConversation = (
  queryClient: QueryClient,
  conversation: Conversation,
) =>
  queryClient.setQueryData(conversationQueryKey(conversation.id), conversation);
