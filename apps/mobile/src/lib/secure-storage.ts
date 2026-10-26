import * as SecureStore from "expo-secure-store";

const KEYS = {
  refreshToken: "dily.refreshToken",
  // Known without network at launch: the session is restored offline
  userId: "dily.userId",
  deviceId: "dily.deviceId",
} as const;

type Key = keyof typeof KEYS;

/** Encrypted storage (iOS Keychain, Android Keystore) for the session. */
export const secureStorage = {
  get: (key: Key) => SecureStore.getItemAsync(KEYS[key]),
  set: (key: Key, value: string) => SecureStore.setItemAsync(KEYS[key], value),
  remove: (key: Key) => SecureStore.deleteItemAsync(KEYS[key]),
};
