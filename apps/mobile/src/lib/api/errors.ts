import type { ApiErrorCode } from "@dily/shared";

/**
 * Error from the API (`{ error, message }`), a network error (`status` 0),
 * or an unreachable server: a 5xx that doesn't come from the API itself
 * (proxy, gateway).
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code:
      | ApiErrorCode
      | "network_error"
      | "server_unreachable"
      | "invalid_response",
    message: string,
    /** Delay announced by `Retry-After` (429), in seconds. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** True when the API itself answered: its message is meant for people. */
  get fromApi(): boolean {
    return (
      this.code !== "network_error" &&
      this.code !== "server_unreachable" &&
      this.code !== "invalid_response" &&
      this.code !== "internal_error"
    );
  }
}

/** The API's own message when there is one, `fallback` otherwise. */
export const apiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiRequestError) {
    if (error.code === "network_error")
      return "No connection. Check your network.";
    if (error.fromApi) return error.message;
  }
  return fallback;
};
