import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { type Session, supabase } from "@/services/supabase";
import {
  isProfileComplete,
  type Profile,
  useProfile,
} from "@/services/auth.service";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  // True until the stored session (and its profile) has been read
  isLoading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    // Fires INITIAL_SESSION with the session restored from MMKV, then every
    // sign-in, sign-out and token refresh
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsRestoring(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const profileQuery = useProfile(userId);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: profileQuery.data ?? null,
      isLoading: isRestoring || (!!userId && profileQuery.isPending),
    }),
    [session, userId, isRestoring, profileQuery.data, profileQuery.isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

/** The signed-in user. Only call from screens behind the signed-in stack. */
export const useUser = () => {
  const { session } = useAuth();
  if (!session) throw new Error("useUser called while signed out");
  return session.user;
};

// Hooks for the `if` of the static root navigator
export const useIsSignedOut = () => !useAuth().session;

export const useNeedsProfile = () => {
  const { session, profile } = useAuth();
  return !!session && !isProfileComplete(profile);
};

export const useIsSignedIn = () => {
  const { session, profile } = useAuth();
  return !!session && isProfileComplete(profile);
};
