import type { AuthTokens } from "@dily/shared";
import { api, setSessionExpiredHandler } from "./api";
import { secureStorage } from "./secure-storage";

export type Session = { user: { id: string } };

type Listener = () => void;

let current: Session | null = null;
const listeners = new Set<Listener>();

const setSession = (next: Session | null) => {
  current = next;
  listeners.forEach((listener) => listener());
};

/** The signed-in user, for `useSyncExternalStore`. Tokens stay in the ApiClient. */
export const sessionStore = {
  get: () => current,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** At launch: a stored refresh token means signed in, even offline. */
export async function restoreSession(): Promise<void> {
  const [hasSession, userId] = await Promise.all([
    api.hasSession(),
    secureStorage.get("userId"),
  ]);
  setSession(hasSession && userId ? { user: { id: userId } } : null);
}

/** After the sign-in code was checked. */
export async function startSession(tokens: AuthTokens): Promise<void> {
  await api.setSession(tokens);
  await secureStorage.set("userId", tokens.userId);
  setSession({ user: { id: tokens.userId } });
}

/** Signed out, or the server refused the session. */
export async function endSession(): Promise<void> {
  await secureStorage.remove("userId");
  setSession(null);
}

setSessionExpiredHandler(() => void endSession());
