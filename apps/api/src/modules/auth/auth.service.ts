import type { AuthTokens, OtpVerifyResponse, PhoneE164 } from "@dily/shared";
import {
  Prisma,
  type PrismaClient,
  type User,
} from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { hashPhone } from "../../lib/phone-hash.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import type { OtpService } from "./otp.service.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  type AccessTokenSigner,
} from "./tokens.js";

export const AUTH_RATE_LIMITS = {
  otpRequestPerPhone: { max: 3, windowSeconds: 15 * 60 },
  // Daily cap: at most 10 codes × 5 attempts = 50 guesses a day per number
  // out of 1,000,000 codes, whatever the attacker's IPs; also bounds what
  // WhatsApp messages to one number cost
  otpRequestPerPhoneDaily: { max: 10, windowSeconds: 24 * 3600 },
  otpRequestPerIp: { max: 20, windowSeconds: 60 * 60 },
  otpVerifyPerIp: { max: 30, windowSeconds: 10 * 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * How long a just-rotated refresh token stays usable once, if its successor
 * hasn't been used: covers a response lost on a flaky mobile network.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 30;

export interface AuthServiceDeps {
  prisma: PrismaClient;
  otp: OtpService;
  rateLimiter: RateLimiter;
  accessTokens: AccessTokenSigner;
  pepper: string;
  refreshTokenTtlSeconds: number;
  now?: () => Date;
}

const invalidRefreshError = () =>
  new AppError(401, "refresh_token_invalid", "Invalid session. Sign in again.");

export class AuthService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(private readonly deps: AuthServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
  }

  async requestOtp(phone: PhoneE164, ip: string): Promise<void> {
    const phoneHash = hashPhone(phone, this.deps.pepper);
    await this.deps.rateLimiter.consume(
      `otp-request:ip:${ip}`,
      AUTH_RATE_LIMITS.otpRequestPerIp,
    );
    await this.deps.rateLimiter.consume(
      `otp-request:phone:${phoneHash}`,
      AUTH_RATE_LIMITS.otpRequestPerPhone,
    );
    await this.deps.rateLimiter.consume(
      `otp-request:phone-daily:${phoneHash}`,
      AUTH_RATE_LIMITS.otpRequestPerPhoneDaily,
    );
    await this.deps.otp.issue(phone);
  }

  async verifyOtp(
    phone: PhoneE164,
    code: string,
    deviceId: string,
    ip: string,
  ): Promise<OtpVerifyResponse> {
    await this.deps.rateLimiter.consume(
      `otp-verify:ip:${ip}`,
      AUTH_RATE_LIMITS.otpVerifyPerIp,
    );
    await this.deps.otp.verify(phone, code);

    const { user, isNewUser } = await this.findOrCreateUser(phone);
    if (user.suspendedAt) {
      throw new AppError(
        403,
        "account_suspended",
        "This account was suspended for breaking Dily's rules.",
      );
    }
    const tokens = await this.issueTokens(user.id, deviceId);
    return { ...tokens, isNewUser };
  }

  /** Swaps a refresh token for a new pair; the old one is revoked (rotation). */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const now = this.now();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (!stored) throw invalidRefreshError();

    let current = stored;
    if (stored.revokedAt) {
      const successor = stored.replacedById
        ? await this.prisma.refreshToken.findUnique({
            where: { id: stored.replacedById },
          })
        : null;
      const withinGrace =
        now.getTime() - stored.revokedAt.getTime() <=
        REFRESH_REUSE_GRACE_SECONDS * 1000;
      if (!successor || successor.revokedAt || !withinGrace) {
        // A revoked token used again: likely stolen, every session is closed
        await this.revokeAllForUser(stored.userId);
        throw invalidRefreshError();
      }
      // Network tolerance: start again from the unused successor the client never got
      current = successor;
    }

    if (current.expiresAt.getTime() <= now.getTime())
      throw invalidRefreshError();

    return this.prisma.$transaction(async (tx) => {
      const next = await this.createRefreshToken(
        tx,
        current.userId,
        current.deviceId,
      );
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now, replacedById: next.record.id },
      });
      // A concurrent request already rotated this token: roll back
      if (count === 0) throw invalidRefreshError();
      return this.toTokens(current.userId, next.token);
    });
  }

  /** Revokes the given refresh token. Idempotent. */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }

  private async findOrCreateUser(
    phone: PhoneE164,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const phoneHash = hashPhone(phone, this.deps.pepper);
    const isTester = this.deps.otp.isTestPhone(phone);
    const existing = await this.prisma.user.findUnique({
      where: { phoneHash },
    });
    if (existing) {
      if (!isTester || existing.isTester)
        return { user: existing, isNewUser: false };
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { isTester: true },
      });
      return { user, isNewUser: false };
    }
    try {
      const user = await this.prisma.user.create({
        data: { phoneE164: phone, phoneHash, isTester },
      });
      return { user, isNewUser: true };
    } catch (error) {
      // Two simultaneous sign-ins for one new number: the other created the account
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const user = await this.prisma.user.findUniqueOrThrow({
          where: { phoneHash },
        });
        return { user, isNewUser: false };
      }
      throw error;
    }
  }

  private async issueTokens(
    userId: string,
    deviceId: string,
  ): Promise<AuthTokens> {
    return this.prisma.$transaction(async (tx) => {
      // One active session per device: signing in again replaces the old one
      await tx.refreshToken.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: this.now() },
      });
      const { token } = await this.createRefreshToken(tx, userId, deviceId);
      return this.toTokens(userId, token);
    });
  }

  private async createRefreshToken(
    tx: Prisma.TransactionClient,
    userId: string,
    deviceId: string,
  ) {
    const token = generateRefreshToken();
    const expiresAt = new Date(
      this.now().getTime() + this.deps.refreshTokenTtlSeconds * 1000,
    );
    const record = await tx.refreshToken.create({
      data: { userId, deviceId, tokenHash: hashRefreshToken(token), expiresAt },
    });
    return { token, record };
  }

  private async toTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    return {
      accessToken: await this.deps.accessTokens.sign(userId, this.now()),
      accessTokenExpiresIn: this.deps.accessTokens.ttlSeconds,
      refreshToken,
      userId,
    };
  }

  /** Revokes every session of the user (stolen token). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }
}
