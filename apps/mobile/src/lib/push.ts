import { messagePushDataSchema, pushTokenBodySchema } from "@dily/shared";
import Constants from "expo-constants";
import { createURL } from "expo-linking";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

// Expo Push delivers to this Android channel when the message names none
const ANDROID_CHANNEL_ID = "default";

/** The token this device registered, to remove it on sign-out. */
let registeredToken: string | null = null;
let openConversationId: string | null = null;

/** The conversation on screen: its own notifications don't pop up over it. */
export const setOpenConversation = (id: string | null) => {
  openConversationId = id;
};

/** Once at startup: also decides what shows while the app is open. */
export function setupNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = messagePushDataSchema.safeParse(
        notification.request.content.data,
      );
      const show = !(
        data.success && data.data.conversationId === openConversationId
      );
      return {
        shouldPlaySound: show,
        shouldSetBadge: false,
        shouldShowBanner: show,
        shouldShowList: show,
      };
    },
  });
}

/**
 * Registers this device's Expo Push token with the API. `prompt`: ask for
 * permission if not decided yet; otherwise only an existing grant is used.
 * Never throws: without push, chat still works while the app is open.
 */
export async function registerForPush(prompt: boolean): Promise<void> {
  try {
    if (Platform.OS === "android") {
      // Android 13+ only shows the permission prompt once a channel exists
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && prompt) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    // No EAS project yet (`eas init`): Expo can't issue a push token
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (token === registeredToken) return;
    await api.request("/me/push-token", {
      method: "PUT",
      body: pushTokenBodySchema.parse({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      }),
    });
    registeredToken = token;
  } catch (error) {
    // No network, push unavailable on this device: tried again next launch
    if (__DEV__) console.warn("Push registration failed", error);
  }
}

/** Signing out: this device stops getting the account's notifications. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api
    .request("/me/push-token", { method: "DELETE", body: { token } })
    .catch(() => undefined);
}

/** The account is gone, and its tokens with it on the server. */
export const forgetPushToken = () => {
  registeredToken = null;
};

/** A tapped message notification as an in-app link: `chat/<conversation id>`. */
export function notificationUrl(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = messagePushDataSchema.safeParse(
    response?.notification.request.content.data,
  );
  return data.success ? createURL(`chat/${data.data.conversationId}`) : null;
}
