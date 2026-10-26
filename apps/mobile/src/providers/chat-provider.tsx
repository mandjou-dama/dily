import type {
  ClientToServerEvents,
  RealtimeConnectError,
  ServerToClientEvents,
} from "@dily/shared";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { io, type Socket } from "socket.io-client";

import { api } from "@/lib/api";
import { env } from "@/lib/env";
import { registerForPush } from "@/lib/push";
import { useAuth, useIsSignedIn } from "@/providers/auth-provider";
import {
  addMessageToCache,
  applyReadToCache,
  CHAT_QUERY_KEY,
  refreshChatSummaries,
} from "@/services/chat.service";

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// After the API refused the connection (expired JWT, server restarting)
const RETRY_DELAY_MS = 2_000;

/**
 * Keeps the signed-in user's chat live: Socket.IO events go straight into
 * the query cache, and this device's push token is registered. Network drops
 * are resumed by Socket.IO itself; a long one reloads the chat data.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const isSignedIn = useIsSignedIn();
  const userId = isSignedIn ? session?.user.id : undefined;

  useEffect(() => {
    if (!userId) return;
    // Only when already allowed: the prompt comes when chatting starts
    void registerForPush(false);

    const socket: RealtimeSocket = io(env.apiUrl, {
      transports: ["websocket"],
      autoConnect: false,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      // Asked on every (re)connection, so the JWT is always a fresh one
      auth: (cb) => {
        api.getAccessToken().then(
          (token) => cb({ token }),
          () => cb({}),
        );
      },
    });
    let stopped = false;
    let connectedOnce = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = () => {
      if (stopped || retry) return;
      retry = setTimeout(() => {
        retry = null;
        if (!stopped) socket.connect();
      }, RETRY_DELAY_MS);
    };

    socket.on("connect", () => {
      // Back after a drop too long to replay: events were missed
      if (connectedOnce && !socket.recovered) {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
      }
      connectedOnce = true;
    });
    socket.on("disconnect", () => {
      // Disconnected by the server (shutdown): Socket.IO doesn't retry on its own
      if (!stopped && !socket.active) scheduleRetry();
    });
    socket.on("connect_error", (error) => {
      // Network error: Socket.IO retries on its own
      if (stopped || socket.active) return;
      const code = (error as Error & { data?: RealtimeConnectError }).data
        ?.error;
      if (code === "unauthorized") {
        // A refused refresh ends the session, which stops this effect
        api.refresh().then(scheduleRetry, scheduleRetry);
        return;
      }
      scheduleRetry();
    });

    socket.on("message:new", ({ message }) => {
      addMessageToCache(queryClient, message);
      refreshChatSummaries(queryClient, userId);
    });
    socket.on("conversation:read", (event) => {
      applyReadToCache(queryClient, event);
      if (event.readerId === userId) refreshChatSummaries(queryClient, userId);
    });

    socket.connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [userId, queryClient]);

  return children;
}
