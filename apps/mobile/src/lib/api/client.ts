import {
  apiErrorSchema,
  authTokensSchema,
  type AuthTokens,
} from "@dily/shared";
import type { z } from "zod";
import { ApiRequestError } from "./errors";

export interface TokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearRefreshToken(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  storage: TokenStorage;
  /** Called when the session is definitely invalid (refresh refused): back to sign-in. */
  onSessionExpired?: () => void;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface RequestOptions<S extends z.ZodType> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON body, or FormData for an upload. */
  body?: unknown;
  /** Schema of the response; without one, the response is ignored. */
  schema?: S;
  /** Send the access JWT (true by default). */
  auth?: boolean;
}

/** Refresh the access JWT this long before it expires. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * HTTP client of the Dily API. The access JWT only lives in memory; the
 * refresh token is in secure storage. Refreshes on its own, one refresh
 * request at a time.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshing: Promise<void> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
    this.now = options.now ?? Date.now;
  }

  /** Stores a new session (after the sign-in code was checked). */
  async setSession(tokens: AuthTokens): Promise<void> {
    this.accessToken = tokens.accessToken;
    this.accessTokenExpiresAt = this.now() + tokens.accessTokenExpiresIn * 1000;
    await this.options.storage.setRefreshToken(tokens.refreshToken);
  }

  async hasSession(): Promise<boolean> {
    return (await this.options.storage.getRefreshToken()) !== null;
  }

  /** Sign-out: revokes the refresh token on the server if possible, then clears everything. */
  async signOut(): Promise<void> {
    const refreshToken = await this.options.storage.getRefreshToken();
    if (refreshToken) {
      await this.send("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      }).catch(() => undefined);
    }
    await this.clearSession();
  }

  /** A valid access JWT (refreshed if needed). */
  async getAccessToken(): Promise<string> {
    if (
      !this.accessToken ||
      this.now() >= this.accessTokenExpiresAt - REFRESH_MARGIN_MS
    ) {
      await this.refresh();
    }
    if (!this.accessToken) {
      throw new ApiRequestError(401, "unauthorized", "No session.");
    }
    return this.accessToken;
  }

  async request<S extends z.ZodType>(
    path: string,
    options: RequestOptions<S> = {},
  ): Promise<z.infer<S>> {
    const auth = options.auth ?? true;
    if (auth) await this.getAccessToken();
    try {
      return await this.send(path, options);
    } catch (error) {
      // JWT refused (expired, secret changed…): one more try after a refresh
      if (auth && error instanceof ApiRequestError && error.status === 401) {
        this.accessToken = null;
        await this.refresh();
        return this.send(path, options);
      }
      throw error;
    }
  }

  /** Refreshes the session; concurrent calls share the same request. */
  refresh(): Promise<void> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = await this.options.storage.getRefreshToken();
    if (!refreshToken) {
      await this.expireSession();
      throw new ApiRequestError(401, "unauthorized", "No session.");
    }
    try {
      const tokens = await this.send("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        schema: authTokensSchema,
        auth: false,
      });
      await this.setSession(tokens);
    } catch (error) {
      // Network error: keep the refresh token to try again later
      if (error instanceof ApiRequestError && error.status === 401) {
        await this.expireSession();
      }
      throw error;
    }
  }

  private async send<S extends z.ZodType>(
    path: string,
    options: RequestOptions<S>,
  ): Promise<z.infer<S>> {
    const headers: Record<string, string> = { accept: "application/json" };
    const isForm = options.body instanceof FormData;
    // FormData sets its own multipart content type, boundary included
    if (options.body !== undefined && !isForm) {
      headers["content-type"] = "application/json";
    }
    if ((options.auth ?? true) && this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        ...(options.body !== undefined
          ? {
              body: isForm
                ? (options.body as FormData)
                : JSON.stringify(options.body),
            }
          : {}),
      });
    } catch {
      throw new ApiRequestError(0, "network_error", "Connection failed.");
    }

    const text = await response.text();
    const json: unknown = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      if (parsed.success) {
        throw new ApiRequestError(
          response.status,
          parsed.data.error,
          parsed.data.message,
          retryAfterSeconds(response.headers.get("retry-after")),
        );
      }
      // A 5xx without the API's error body comes from something in front of
      // it (proxy, gateway): the API always answers `{ error, message }`
      throw new ApiRequestError(
        response.status,
        response.status >= 500 ? "server_unreachable" : "internal_error",
        `HTTP ${response.status}`,
      );
    }

    if (!options.schema) return undefined as z.infer<S>;
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiRequestError(
        response.status,
        "invalid_response",
        "Unexpected response from the server.",
      );
    }
    return parsed.data;
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    await this.options.storage.clearRefreshToken();
  }

  private async expireSession(): Promise<void> {
    await this.clearSession();
    this.options.onSessionExpired?.();
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `Retry-After` in seconds (the API never sends the HTTP date form). */
function retryAfterSeconds(header: string | null): number | undefined {
  const seconds = Number(header);
  return header && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}
