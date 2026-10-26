import { z } from "zod";

/** `PUT` / `DELETE /me/push-token`: the device's Expo Push token. */
export const pushTokenBodySchema = z.object({
  token: z
    .string()
    .max(200)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Invalid Expo push token"),
  platform: z.enum(["ios", "android"]),
});
export type PushTokenBody = z.infer<typeof pushTokenBodySchema>;

export const removePushTokenBodySchema = pushTokenBodySchema.pick({
  token: true,
});

/** `data` of a new message notification: tapping it opens the conversation. */
export const messagePushDataSchema = z.object({
  type: z.literal("message"),
  conversationId: z.uuid(),
});
export type MessagePushData = z.infer<typeof messagePushDataSchema>;
