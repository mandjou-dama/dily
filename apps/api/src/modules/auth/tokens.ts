import { createHash, randomBytes } from "node:crypto";
import { errors, jwtVerify, SignJWT } from "jose";
import { AppError } from "../../lib/errors.js";

const ISSUER = "dily-api";
const AUDIENCE = "dily-app";

export interface AccessTokenOptions {
  secret: string;
  ttlSeconds: number;
}

/** Short-lived access JWT (HS256). The subject is the user id. */
export class AccessTokenSigner {
  private readonly key: Uint8Array;

  constructor(private readonly options: AccessTokenOptions) {
    this.key = new TextEncoder().encode(options.secret);
  }

  get ttlSeconds(): number {
    return this.options.ttlSeconds;
  }

  sign(userId: string, now: Date = new Date()): Promise<string> {
    const iat = Math.floor(now.getTime() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(iat + this.options.ttlSeconds)
      .sign(this.key);
  }

  /** Returns the user id, or throws 401 `unauthorized`. */
  async verify(token: string, now: Date = new Date()): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
        currentDate: now,
      });
      if (!payload.sub) throw new Error("missing sub");
      return payload.sub;
    } catch (error) {
      const message =
        error instanceof errors.JWTExpired
          ? "Session expired."
          : "Invalid access token.";
      throw new AppError(401, "unauthorized", message);
    }
  }
}

/** Opaque refresh token: 256 random bits, only its SHA-256 is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
