import "react-native-url-polyfill/auto";

import { AppState } from "react-native";

import { createClient } from "@supabase/supabase-js";

import * as SessionStorage from "./storage";

// Expo only inlines env vars prefixed with EXPO_PUBLIC_ into the JS bundle.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Better to throw early if env vars are missing
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase env vars are missing!");
}

export const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      storage: SessionStorage,
      persistSession: true,
      detectSessionInUrl: false,
      autoRefreshToken: true,
    },
  }
);

export { type AuthError, type Session } from "@supabase/supabase-js";

/**
 * Tells Supabase to autorefresh the session while the application
 * is in the foreground. (Docs: https://supabase.com/docs/reference/javascript/auth-startautorefresh)
 */
AppState.addEventListener("change", (nextAppState) => {
  if (nextAppState === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
