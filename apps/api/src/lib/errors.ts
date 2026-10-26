import type { ApiErrorCode } from "@dily/shared";

/** Domain error, turned into an HTTP `{ error, message }` response by the error handler. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    /** Headers added to the response (e.g. `Retry-After`). */
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Not found.") =>
  new AppError(404, "not_found", message);
