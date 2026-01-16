import { Platform } from "react-native";

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { createMMKV } from "react-native-mmkv";

const fetchOrGenerateEncryptionKey = (): string => {
  const encryptionKey = SecureStore.getItem("session-encryption-key");

  if (encryptionKey) {
    return encryptionKey;
  } else {
    const uuid = Crypto.randomUUID();
    SecureStore.setItem("session-encryption-key", uuid);
    return uuid;
  }
};

export const storage = createMMKV({
  id: "session",
  encryptionKey:
    Platform.OS === "web" ? fetchOrGenerateEncryptionKey() : undefined,
});

// TODO: Remove this workaround for encryption: https://github.com/mrousavy/react-native-mmkv/issues/665
storage.set("workaround", true);

/**
 * A simple wrapper around MMKV that provides a base API
 * that matches AsyncStorage for use with Supabase.
 */

/**
 * Get an item from storage by key
 *
 * @param {string} key of the item to fetch
 * @returns {Promise<string | null>} value for the key as a string or null if not found
 */
export async function getItem(key: string): Promise<string | null> {
  try {
    return storage.getString(key) ?? null;
  } catch {
    console.warn(`Failed to get key "${key}" from secure storage`);
    return null;
  }
}

/**
 * Sets an item in storage by key
 *
 * @param {string} key of the item to store
 * @param {string} value of the item to store
 */
export async function setItem(key: string, value: string): Promise<void> {
  try {
    storage.set(key, value);
  } catch {
    console.warn(`Failed to set key "${key}" in secure storage`);
  }
}
/**
 * Removes a single item from storage by key
 *
 * @param {string} key of the item to remove
 */
export async function removeItem(key: string): Promise<void> {
  try {
    storage.remove(key);
  } catch {
    console.warn(`Failed to remove key "${key}" from secure storage`);
  }
}
