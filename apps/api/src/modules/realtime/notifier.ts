import type { ServerToClientEvents } from "@dily/shared";

export type EmitToUser = <E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => void;

/**
 * Sends events to users. Services get it before Socket.IO is attached
 * (`bind` at startup); unbound, events are dropped and the app reads the
 * state again when it reconnects.
 */
export class UserNotifier {
  private emit: EmitToUser | null = null;

  bind(emit: EmitToUser): void {
    this.emit = emit;
  }

  send: EmitToUser = (userId, event, ...args) => {
    this.emit?.(userId, event, ...args);
  };
}
