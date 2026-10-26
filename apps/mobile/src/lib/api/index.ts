import { env } from "../env";
import { secureStorage } from "../secure-storage";
import { ApiClient } from "./client";

export { ApiRequestError, apiErrorMessage } from "./errors";

let sessionExpiredHandler = () => {};

/** Called when the server refuses the session; set by lib/session. */
export const setSessionExpiredHandler = (handler: () => void) => {
  sessionExpiredHandler = handler;
};

/** Client shared by the whole app. */
export const api = new ApiClient({
  baseUrl: env.apiUrl,
  storage: {
    getRefreshToken: () => secureStorage.get("refreshToken"),
    setRefreshToken: (token) => secureStorage.set("refreshToken", token),
    clearRefreshToken: () => secureStorage.remove("refreshToken"),
  },
  onSessionExpired: () => sessionExpiredHandler(),
});
