// Centralized auth state machine + provider.
//
//   INITIALIZING -> (restore) -> SIGNED_IN | SIGNED_OUT
//   SIGNED_OUT   -> signIn* -> AUTHENTICATING -> SIGNED_IN | ERROR
//   SIGNED_IN    -> signOut -> SIGNED_OUT
//
// Startup order: init DB -> (web) process OAuth callback -> restore session ->
// load local user -> route. `initializing` stays true until this resolves so
// the app never flashes the Home screen before auth is known.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthService, OnboardingService } from "@/src/services";
import { EmergentAuth } from "@/src/services/auth/emergent-auth";
import { initDatabase } from "@/src/database";
import { User } from "@/src/types";

export type AuthStatus =
  | "INITIALIZING"
  | "SIGNED_OUT"
  | "AUTHENTICATING"
  | "SIGNED_IN"
  | "ERROR";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  initializing: boolean; // derived: status === "INITIALIZING"
  error: string | null;
  onboardingComplete: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<AuthStatus>("INITIALIZING");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.warn("[auth] database init failed", e);
      }

      const ob = await OnboardingService.isComplete();
      if (!cancelled) setOnboardingComplete(ob);

      // Web OAuth callback: process a returned session_id FIRST.
      const webSessionId = EmergentAuth.readWebCallback();
      if (webSessionId) {
        try {
          const u = await AuthService.completeGoogleSession(webSessionId);
          EmergentAuth.clearWebCallback();
          if (!cancelled) {
            setUser(u);
            setStatus("SIGNED_IN");
          }
          return;
        } catch (e) {
          console.warn("[auth] web session exchange failed");
          EmergentAuth.clearWebCallback();
        }
      }

      // Otherwise restore an existing session.
      try {
        const restored = await AuthService.restoreSession();
        if (!cancelled) {
          setUser(restored);
          setStatus(restored ? "SIGNED_IN" : "SIGNED_OUT");
        }
      } catch (e) {
        console.warn("[auth] restore failed", e);
        if (!cancelled) setStatus("SIGNED_OUT");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setStatus("AUTHENTICATING");
    try {
      const u = await AuthService.signInWithGoogle();
      setUser(u);
      setStatus("SIGNED_IN");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      setError(msg);
      setStatus("SIGNED_OUT");
      throw e;
    }
  }, []);

  const signInWithDemo = useCallback(async () => {
    setError(null);
    setStatus("AUTHENTICATING");
    try {
      const u = await AuthService.signInWithDemo();
      setUser(u);
      setStatus("SIGNED_IN");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      setError(msg);
      setStatus("SIGNED_OUT");
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await AuthService.signOut();
    } finally {
      setUser(null);
      setStatus("SIGNED_OUT");
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    await OnboardingService.complete();
    setOnboardingComplete(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      initializing: status === "INITIALIZING",
      error,
      onboardingComplete,
      signInWithGoogle,
      signInWithDemo,
      signOut,
      completeOnboarding,
    }),
    [
      status,
      user,
      error,
      onboardingComplete,
      signInWithGoogle,
      signInWithDemo,
      signOut,
      completeOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
