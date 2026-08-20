// App-wide constants (routes, storage keys, config).

export const APP = {
  name: "NASUKI",
  tagline: "YOUR LOCAL AI",
  version: "1.0",
} as const;

export const STORAGE_KEYS = {
  onboardingComplete: "nasuki.onboarding.complete",
  authUser: "nasuki.auth.user",
  themeMode: "nasuki.theme.mode",
  // ---- Phase 2 session ----
  // Sensitive (Keychain / SecureStore) — Google session token only.
  sessionToken: "nasuki.auth.session_token",
  // Non-sensitive session descriptor (which method + which local user).
  authMethod: "nasuki.auth.method",
  activeUserId: "nasuki.auth.active_user_id",
} as const;

// Authentication configuration.
// Demo login is a DEVELOPMENT-ONLY path. It is enabled automatically in dev
// (__DEV__) and can be force-enabled via EXPO_PUBLIC_DEV_AUTH_ENABLED="true".
// In production release builds it defaults to DISABLED — no hidden bypass.
export const AUTH = {
  devAuthEnabled:
    (typeof __DEV__ !== "undefined" && __DEV__) ||
    process.env.EXPO_PUBLIC_DEV_AUTH_ENABLED === "true",
  demoUserId: "demo-user",
} as const;

// Backend base URL (from public Expo env). The ingress routes /api/* to FastAPI.
export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/+$/, "");

// 1 credit = 20 messages (from Figma Home card).
export const CREDITS = {
  messagesPerCredit: 20,
  rewardPerAd: 5,
  starting: 100,
} as const;
