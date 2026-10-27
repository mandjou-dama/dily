import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COUNTRY_CODE,
  LOCAL_PHONE_LENGTH,
  OTP_CODE_LENGTH,
  otpVerifyResponseSchema,
  type Profile,
  profileSchema,
  TERMS_VERSION,
} from "@dily/shared";

import { api, apiErrorMessage } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { forgetPushToken, unregisterPush } from "@/lib/push";
import { endSession, startSession } from "@/lib/session";
import { compressImage, imageFormData } from "@/lib/upload";

export type { Profile };
export { COUNTRY_CODE, LOCAL_PHONE_LENGTH };
export const OTP_LENGTH = OTP_CODE_LENGTH;

// An avatar shows at most ~120pt wide: 800px covers any density
const AVATAR_MAX_SIDE = 800;

export const profileQueryKey = (userId: string | undefined) => [
  "profile",
  userId,
];

/** Keeps digits only, so "70 00 00 00" and "70000000" are the same number. */
export const normalizeLocalPhone = (input: string) =>
  input.replace(/\D/g, "").slice(0, LOCAL_PHONE_LENGTH);

/** E.164, the format the API expects: "+22370000000". */
export const toE164 = (localPhone: string) =>
  `+${COUNTRY_CODE}${normalizeLocalPhone(localPhone)}`;

export const isProfileComplete = (profile: Profile | null | undefined) =>
  !!profile?.fullName?.trim();

/** Text shown when a code can't be sent: the API says why (rate limit, WhatsApp down…). */
export const sendOtpErrorMessage = (error: Error) =>
  apiErrorMessage(
    error,
    "We couldn't send the code on WhatsApp. Check the number and try again.",
  );

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      api.request("/auth/otp/request", {
        method: "POST",
        body: { phone },
        auth: false,
      }),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      const tokens = await api.request("/auth/otp/verify", {
        method: "POST",
        body: { phone, code: token, deviceId: await getDeviceId() },
        schema: otpVerifyResponseSchema,
        auth: false,
      });
      // The root navigator swaps to the profile or app screens
      await startSession(tokens);
      return tokens;
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // While the session still works: the API must know whose token it was
      await unregisterPush();
      await api.signOut();
      await endSession();
    },
    onSuccess: () => queryClient.clear(),
  });
}

/**
 * Deletes the account for good: listings, photos, favorites, sessions. The
 * root navigator then swaps to the sign-in screens.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.request("/me", { method: "DELETE" });
      forgetPushToken();
      await api.forgetSession();
      await endSession();
    },
    onSuccess: () => queryClient.clear(),
  });
}

/** The user hasn't accepted the terms in force yet (or ever). */
export const needsTerms = (profile: Profile | null | undefined) =>
  !!profile && profile.termsVersion !== TERMS_VERSION;

/** "J'accepte": the terms in force, the ones the app shows. */
export function useAcceptTerms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.request("/me/terms", {
        method: "PUT",
        body: { version: TERMS_VERSION },
        schema: profileSchema,
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: () => api.request("/me", { schema: profileSchema }),
  });
}

type UpdateProfileVars = {
  fullName: string;
  // Where the seller meets buyers; blank clears it
  neighbourhood?: string;
  // Local file uri from the image picker
  avatarUri?: string;
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fullName,
      neighbourhood,
      avatarUri,
    }: UpdateProfileVars) => {
      if (avatarUri) {
        const uri = await compressImage(avatarUri, AVATAR_MAX_SIDE);
        await api.request("/me/avatar", {
          method: "PUT",
          body: imageFormData(uri),
        });
      }

      return api.request("/me", {
        method: "PATCH",
        body: { fullName, neighbourhood },
        schema: profileSchema,
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}
