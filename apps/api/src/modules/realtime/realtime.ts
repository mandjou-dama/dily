import {
  REALTIME_RECOVERY_SECONDS,
  type ClientToServerEvents,
  type RealtimeConnectError,
  type ServerToClientEvents,
} from "@dily/shared";
import type { FastifyInstance } from "fastify";
import { Server, type ExtendedError } from "socket.io";
import type { Authenticate } from "../../lib/auth-guard.js";
import { AppError } from "../../lib/errors.js";
import type { EmitToUser } from "./notifier.js";

interface SocketData {
  userId: string;
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Socket.IO room holding every connection of one user (several devices). */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Realtime channel (Socket.IO) on Fastify's HTTP server, server to app only.
 * The access JWT (`auth: { token }`) is checked on every (re)connection; a
 * short drop gets its missed events back on reconnecting.
 */
export function attachRealtime(
  app: FastifyInstance,
  deps: { authenticate: Authenticate },
) {
  const io: RealtimeServer = new Server(app.server, {
    serveClient: false,
    // The app isn't a browser: no CORS to open. WebSocket only (mobile networks)
    transports: ["websocket"],
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // The app sends nothing; this only bounds what a modified client can push
    maxHttpBufferSize: 4 * 1024,
    connectionStateRecovery: {
      maxDisconnectionDuration: REALTIME_RECOVERY_SECONDS * 1000,
      // The JWT and the account are checked again, even on a recovery
      skipMiddlewares: false,
    },
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown };
    const token = typeof auth.token === "string" ? auth.token : undefined;
    deps.authenticate(token).then(
      (user) => {
        socket.data.userId = user.id;
        next();
      },
      (error: unknown) => next(connectError(error)),
    );
  });

  io.on("connection", (socket) => {
    void socket.join(userRoom(socket.data.userId));
  });

  // WebSockets close before the HTTP server, or shutting down waits for them
  app.addHook("preClose", async () => {
    io.local.disconnectSockets(true);
    await io.close();
  });

  const emitToUser: EmitToUser = (userId, event, ...args) => {
    io.to(userRoom(userId)).emit(event, ...args);
  };
  return { io, emitToUser };
}

export type Realtime = ReturnType<typeof attachRealtime>;

function connectError(error: unknown): ExtendedError {
  const data: RealtimeConnectError =
    error instanceof AppError
      ? { error: error.code, message: error.message }
      : { error: "internal_error", message: "Something went wrong." };
  const err = new Error(data.error) as ExtendedError;
  err.data = data;
  return err;
}
