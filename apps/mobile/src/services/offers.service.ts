import {
  type InfiniteData,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  acceptedOfferSchema,
  type ChatMessage,
  chatMessageSchema,
  type Conversation,
  type Fulfilment,
  type MessagePage,
  type Offer,
  offerSchema,
  type Order,
} from "@dily/shared";
import { randomUUID } from "expo-crypto";

import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  addMessageToCache,
  conversationQueryKey,
  messagesQueryKey,
  refreshChatSummaries,
} from "@/services/chat.service";

export type { Offer, Order };

export type OfferInput = {
  amount: number;
  fulfilment: Fulfilment;
  deliveryArea: string | null;
};

/**
 * An offer or a counter-offer. The id is generated once per offer, so a
 * retry after a network error never sends it twice.
 */
export function useMakeOffer(conversationId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: ({ id, ...input }: OfferInput & { id: string }) =>
      api.request(`/conversations/${conversationId}/offers`, {
        method: "POST",
        body: { id, ...input },
        schema: chatMessageSchema,
      }),
    onSuccess: (message) => {
      applyMessageToCache(queryClient, message);
      if (session) refreshChatSummaries(queryClient, session.user.id);
    },
  });
}

/** New id for a new offer: kept across retries of the same one. */
export const newOfferId = () => randomUUID();

/** "D'accord" or "Non merci" on the other person's offer. */
export function useAnswerOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      answer,
    }: {
      offerId: string;
      answer: "accept" | "decline";
    }) => {
      if (answer === "accept") {
        return api.request(`/offers/${offerId}/accept`, {
          method: "POST",
          schema: acceptedOfferSchema,
        });
      }
      const offer = await api.request(`/offers/${offerId}/decline`, {
        method: "POST",
        schema: offerSchema,
      });
      return { offer, order: null };
    },
    onSuccess: ({ offer, order }) => {
      applyOfferToCache(queryClient, offer);
      if (order) applyOrderToCache(queryClient, order);
    },
  });
}

// Cache updates shared by the screens and the realtime events

/** A new message, with the offer or order it brings, into the caches. */
export function applyMessageToCache(
  queryClient: QueryClient,
  message: ChatMessage,
) {
  addMessageToCache(queryClient, message);
  if (message.offer) applyOfferToCache(queryClient, message.offer);
  if (message.order) applyOrderToCache(queryClient, message.order);
}

/** Replaces the loaded messages that match, leaving the others as they are. */
function updateMessages(
  queryClient: QueryClient,
  conversationId: string,
  update: (message: ChatMessage) => ChatMessage | null,
) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    messagesQueryKey(conversationId),
    (data) => {
      if (!data) return data;
      let changed = false;
      const pages = data.pages.map((page) => {
        let pageChanged = false;
        const items = page.items.map((message) => {
          const next = update(message);
          if (!next) return message;
          pageChanged = true;
          return next;
        });
        if (!pageChanged) return page;
        changed = true;
        return { ...page, items };
      });
      return changed ? { ...data, pages } : data;
    },
  );
}

/** An offer's new status: its card in the chat, and the deal at the top. */
export function applyOfferToCache(queryClient: QueryClient, offer: Offer) {
  updateMessages(queryClient, offer.conversationId, (message) =>
    message.offer?.id === offer.id ? { ...message, offer } : null,
  );
  queryClient.setQueryData<Conversation | null>(
    conversationQueryKey(offer.conversationId),
    (conversation) => {
      if (!conversation) return conversation;
      const current = conversation.deal.offer;
      // An older offer changing doesn't replace the newest one
      if (current && current.id !== offer.id) {
        if (current.createdAt > offer.createdAt) return conversation;
      }
      return { ...conversation, deal: { ...conversation.deal, offer } };
    },
  );
}

/** An order's new status: its card in the chat, and the deal at the top. */
export function applyOrderToCache(queryClient: QueryClient, order: Order) {
  updateMessages(queryClient, order.conversationId, (message) =>
    message.order?.id === order.id ? { ...message, order } : null,
  );
  queryClient.setQueryData<Conversation | null>(
    conversationQueryKey(order.conversationId),
    (conversation) => {
      if (!conversation) return conversation;
      const current = conversation.deal.order;
      if (current && current.id !== order.id) {
        if (current.createdAt > order.createdAt) return conversation;
      }
      return {
        ...conversation,
        // Paid: the listing is sold
        product:
          order.status === "paid"
            ? { ...conversation.product, status: "sold" }
            : conversation.product,
        deal: { ...conversation.deal, order },
      };
    },
  );
}
