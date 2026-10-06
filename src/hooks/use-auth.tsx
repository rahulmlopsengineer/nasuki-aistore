// Centralized auth state machine + provider.
// BYPASS MODE: Automatically signed in as demo user for verification.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthService, OnboardingService } from "@/src/services";
import { initDatabase } from "@/src/database";
import { User } from "@/src/types";
import { setActiveUserId } from "@/src/services/active-user";

export type AuthStatus =
  | "INITIALIZING"
  | "SIGNED_OUT"
  | "AUTHENTICATING"
  | "SIGNED_IN"
  | "ERROR";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  initializing: boolean;
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
  const [status, setStatus] = useState<AuthStatus>("SIGNED_IN");
  const [user, setUser] = useState<User | null>({
    id: "demo-user",
    name: "Demo User",
    email: "demo@nasuki.local",
    method: "demo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemoUser: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  useEffect(() => {
    setActiveUserId("demo-user");
    (async () => {
      try {
        await initDatabase();
        setActiveUserId("demo-user");
      } catch (e) {
        console.warn("[auth] database init failed", e);
      }
    })();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setActiveUserId("demo-user");
    setUser({
      id: "demo-user",
      name: "Demo User",
      email: "demo@nasuki.local",
      method: "google",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemoUser: false,
    });
    setStatus("SIGNED_IN");
  }, []);

  const signInWithDemo = useCallback(async () => {
    setActiveUserId("demo-user");
    setUser({
      id: "demo-user",
      name: "Demo User",
      email: "demo@nasuki.local",
      method: "demo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemoUser: true,
    });
    setStatus("SIGNED_IN");
  }, []);

  const signOut = useCallback(async () => {
    setActiveUserId("demo-user");
    setUser({
      id: "demo-user",
      name: "Demo User",
      email: "demo@nasuki.local",
      method: "demo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemoUser: true,
    });
    setStatus("SIGNED_IN");
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      initializing: false,
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
