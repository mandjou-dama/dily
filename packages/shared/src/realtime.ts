import type { ChatMessage } from "./chat";
import type { ApiError } from "./errors";
import type { Offer, Order } from "./offers";

/**
 * A connection lost for less than this gets its missed events on
 * reconnecting; past it, the app reads the conversations again.
 */
export const REALTIME_RECOVERY_SECONDS = 120;

export interface MessageNewEvent {
  message: ChatMessage;
}

export interface ConversationReadEvent {
  conversationId: string;
  // Who read: the other person's messages up to `readAt` are now read
  readerId: string;
  readAt: string;
}

export interface OfferUpdatedEvent {
  offer: Offer;
}

export interface OrderUpdatedEvent {
  order: Order;
}

/** Events the API sends to the app (Socket.IO). */
export interface ServerToClientEvents {
  /** A message in one of the user's conversations, theirs included (other devices). */
  "message:new": (payload: MessageNewEvent) => void;
  "conversation:read": (payload: ConversationReadEvent) => void;
  /** An offer was accepted, declined or replaced, in a conversation of the user's. */
  "offer:updated": (payload: OfferUpdatedEvent) => void;
  /** An order of the user's, as buyer or seller, changed status. */
  "order:updated": (payload: OrderUpdatedEvent) => void;
}

/** The app sends nothing over the socket: messages go through HTTP. */
export type ClientToServerEvents = Record<string, never>;

/** `data` of a refused connection (`connect_error`): same shape as HTTP errors. */
export type RealtimeConnectError = ApiError;
