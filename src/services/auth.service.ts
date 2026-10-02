import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/services/supabase";
import type { Tables, TablesUpdate } from "@/types/supabase";

export type Profile = Tables<"profiles">;

// Mali numbers: 8 digits after the +223 country code
export const COUNTRY_CODE = "223";
export const LOCAL_PHONE_LENGTH = 8;
export const OTP_LENGTH = 6;

export const profileQueryKey = (userId: string | undefined) => [
  "profile",
  userId,
];

/** Keeps digits only, so "70 00 00 00" and "70000000" are the same number. */
export const normalizeLocalPhone = (input: string) =>
  input.replace(/\D/g, "").slice(0, LOCAL_PHONE_LENGTH);

/** E.164 without the "+", the format Supabase stores and expects. */
export const toE164 = (localPhone: string) =>
  `${COUNTRY_CODE}${normalizeLocalPhone(localPhone)}`;

export const isProfileComplete = (profile: Profile | null | undefined) =>
  !!profile?.full_name?.trim();

/**
 * Text shown when a code can't be sent. Supabase's own message is only useful
 * for rate limits; WhatsApp failures arrive as "Unexpected status code
 * returned from hook: 502".
 */
export const sendOtpErrorMessage = (error: Error) =>
  (error as Error & { status?: number }).status === 429
    ? error.message
    : "We couldn't send the code on WhatsApp. Check the number and try again.";

export function useSendOtp() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: "whatsapp" },
      });
      if (error) throw error;
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) throw error;
      return data.session;
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => queryClient.clear(),
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

type UpdateProfileVars = {
  userId: string;
  fullName: string;
  // Local file uri from the image picker
  avatarUri?: string;
};

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, fullName, avatarUri }: UpdateProfileVars) => {
      const changes: TablesUpdate<"profiles"> = { full_name: fullName.trim() };

      if (avatarUri) {
        changes.avatar_url = await uploadAvatar(userId, avatarUri);
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}

/** Uploads to avatars/<uid>/avatar.<ext> and returns the Storage path. */
async function uploadAvatar(userId: string, uri: string) {
  const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType = extension === "png" ? "image/png" : "image/jpeg";
  const path = `${userId}/avatar.${extension === "png" ? "png" : "jpg"}`;

  // fetch() on a file:// uri gives the bytes without base64 round trips
  const body = await fetch(uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  return path;
}
