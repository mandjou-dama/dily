import { randomUUID } from "expo-crypto";
import { secureStorage } from "./secure-storage";

let cached: string | null = null;

/** Stable id of this install, sent at sign-in (one session per device). */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await secureStorage.get("deviceId");
  if (stored) return (cached = stored);
  const created = randomUUID();
  await secureStorage.set("deviceId", created);
  return (cached = created);
}
