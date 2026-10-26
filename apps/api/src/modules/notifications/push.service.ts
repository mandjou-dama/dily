import type { PushTokenBody } from "@dily/shared";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Per message, in sending order: accepted by Expo, or refused right away. */
export type PushResult =
  { ok: true } | { ok: false; deviceNotRegistered: boolean };

/** The actual sending: Expo Push for real, a fake in tests. */
export interface PushSender {
  send(messages: (PushMessage & { to: string })[]): Promise<PushResult[]>;
}

/** Sends through Expo's push service (APNs and FCM behind it). */
export function expoPushSender(accessToken?: string): PushSender {
  const expo = new Expo(accessToken ? { accessToken } : {});
  return {
    async send(messages) {
      const results: PushResult[] = [];
      const payload: ExpoPushMessage[] = messages.map((m) => ({
        to: m.to,
        title: m.title,
        body: m.body,
        sound: "default",
        ...(m.data ? { data: m.data } : {}),
      }));
      for (const chunk of expo.chunkPushNotifications(payload)) {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          results.push(
            ticket.status === "ok"
              ? { ok: true }
              : {
                  ok: false,
                  deviceNotRegistered:
                    ticket.details?.error === "DeviceNotRegistered",
                },
          );
        }
      }
      return results;
    },
  };
}

export interface PushServiceDeps {
  prisma: PrismaClient;
  sender: PushSender;
  logger: FastifyBaseLogger;
}

/**
 * Devices' push tokens, and notifications to a user. Expo's later receipts
 * (Apple's or Google's answer) aren't read yet: that needs a scheduled job.
 */
export class PushService {
  constructor(private readonly deps: PushServiceDeps) {}

  /** Registers the device's token; a token already known moves to this account. */
  async register(
    userId: string,
    { token, platform }: PushTokenBody,
  ): Promise<void> {
    await this.deps.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  /** Signing out: the device gets nothing more for this account. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.deps.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  /**
   * Sends to every device of the user; returns how many Expo accepted.
   * Never throws: Expo unreachable is logged, the message itself is saved.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<number> {
    const tokens = await this.deps.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return 0;

    let results: PushResult[];
    try {
      results = await this.deps.sender.send(
        tokens.map((t) => ({ ...message, to: t.token })),
      );
    } catch (error) {
      this.deps.logger.error({ err: error, userId }, "push: sending failed");
      return 0;
    }

    // App uninstalled or token expired: forget it
    const stale = tokens.filter((_, i) => {
      const result = results[i];
      return result && !result.ok && result.deviceNotRegistered;
    });
    if (stale.length > 0) {
      await this.deps.prisma.pushToken.deleteMany({
        where: { token: { in: stale.map((t) => t.token) } },
      });
    }
    const failed = results.filter((r) => !r.ok).length;
    if (failed > stale.length) {
      this.deps.logger.warn({ userId, failed }, "push: refused by Expo");
    }
    return results.filter((r) => r.ok).length;
  }
}
