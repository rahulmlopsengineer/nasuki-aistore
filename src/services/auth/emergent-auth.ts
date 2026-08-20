// Emergent-managed Google auth flow helper (keyless). Isolated behind this
// module so AuthService stays clean. The frontend NEVER contacts the Emergent
// API directly — it only obtains the one-time `session_id` and hands it to our
// own backend (/api/auth/session).
//
// EXPO GO LIMITATION: On Android Expo Go the Custom Tabs redirect back into the
// app is unreliable, so Google sign-in is best-effort there. Demo login is the
// primary development path. Google works on web preview and in a proper
// Development Build / production build with the app scheme registered.

import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const AUTH_BASE = "https://auth.emergentagent.com/";

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    return (typeof window !== "undefined" ? window.location.origin : "") + "/";
  }
  return Linking.createURL("");
}

function buildAuthUrl(): string {
  return `${AUTH_BASE}?redirect=${encodeURIComponent(getRedirectUrl())}`;
}

export const EmergentAuth = {
  isWeb: Platform.OS === "web",
  extractSessionId,

  /** Web only: navigate the whole page to the auth screen. */
  beginWebRedirect(): void {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = buildAuthUrl();
    }
  },

  /** Web only: read session_id from the current URL (hash or query). */
  readWebCallback(): string | null {
    if (Platform.OS !== "web" || typeof window === "undefined") return null;
    return (
      extractSessionId(window.location.hash) ?? extractSessionId(window.location.search)
    );
  },

  /** Web only: strip session_id from the URL after a successful exchange. */
  clearWebCallback(): void {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.delete("session_id");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // best-effort URL cleanup
    }
  },

  /**
   * Native: open the auth session and resolve a session_id from result.url,
   * the deep-link event, or getInitialURL. Returns null if the user cancelled.
   */
  async openNativeAuth(): Promise<string | null> {
    const redirect = getRedirectUrl();
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", (e) => {
      const s = extractSessionId(e.url);
      if (s) captured = s;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(buildAuthUrl(), redirect);
      let sessionId: string | null = null;
      if (result.type === "success" && "url" in result) {
        sessionId = extractSessionId(result.url);
      }
      if (!sessionId) sessionId = captured;
      if (!sessionId) sessionId = extractSessionId(await Linking.getInitialURL());
      return sessionId;
    } finally {
      sub.remove();
    }
  },
};
