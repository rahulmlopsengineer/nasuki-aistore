// AuthService — the single clean interface the app uses for authentication.
//
//   Google auth  -> Emergent keyless flow -> backend /api/auth/session
//   Demo auth    -> local-only, DEV-ONLY (AUTH.devAuthEnabled)
//
// Session token (Google only) lives in the secure Keychain/SecureStore. The
// local user profile lives in SQLite. Tokens are NEVER written to SQLite,
// AsyncStorage, or logs.

import { AUTH, STORAGE_KEYS } from "@/src/constants/config";
import { CreditRepository, UserRepository, initDatabase } from "@/src/database";
import { UserRow } from "@/src/database/types";
import { AuthMethod, User } from "@/src/types";
import { storage } from "@/src/utils/storage";
import { api, ApiError, BackendUser } from "./api-client";
import { EmergentAuth } from "./auth/emergent-auth";
import { setActiveUserId } from "./active-user";

// Guard against exchanging the same one-time session_id twice.
const exchangedSessionIds = new Set<string>();

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    avatarUrl: row.profile_image ?? undefined,
    method: (row.auth_provider as AuthMethod) ?? "demo",
    createdAt: row.created_at,
    remoteId: row.remote_id,
    profileImage: row.profile_image,
    isDemoUser: !!row.is_demo_user,
    updatedAt: row.updated_at,
  };
}

async function activate(row: UserRow): Promise<User> {
  await CreditRepository.ensureWallet(row.id);
  setActiveUserId(row.id);
  await storage.setItem(STORAGE_KEYS.activeUserId, row.id);
  await storage.setItem(STORAGE_KEYS.authMethod, row.auth_provider);
  return rowToUser(row);
}

async function upsertFromBackend(u: BackendUser): Promise<UserRow> {
  return UserRepository.upsert({
    id: u.user_id,
    remoteId: u.user_id,
    name: u.name ?? "NASUKI User",
    email: u.email ?? null,
    profileImage: u.picture ?? null,
    authProvider: "google",
    isDemoUser: false,
  });
}

export const AuthService = {
  /** Ensure the local database is ready. Safe to call repeatedly. */
  async initialize(): Promise<void> {
    await initDatabase();
  },

  // ---- Demo (development only) ---------------------------------------------
  async signInWithDemo(): Promise<User> {
    if (!AUTH.devAuthEnabled) {
      throw new Error("Demo login is disabled in this environment.");
    }
    await initDatabase();
    const row = await UserRepository.upsert({
      id: AUTH.demoUserId,
      remoteId: null,
      name: "Demo User",
      email: null,
      profileImage: null,
      authProvider: "demo",
      isDemoUser: true,
    });
    return activate(row);
  },

  // ---- Google (Emergent keyless) -------------------------------------------
  async signInWithGoogle(): Promise<User> {
    await initDatabase();
    if (EmergentAuth.isWeb) {
      // Navigates the page away; resolves after redirect via completeGoogleSession.
      EmergentAuth.beginWebRedirect();
      // The page unloads; this promise intentionally never resolves.
      return new Promise<User>(() => {});
    }
    const sessionId = await EmergentAuth.openNativeAuth();
    if (!sessionId) throw new Error("Google sign-in was cancelled.");
    return this.completeGoogleSession(sessionId);
  },

  /** Exchange a one-time session_id for a session and local user. */
  async completeGoogleSession(sessionId: string): Promise<User> {
    if (exchangedSessionIds.has(sessionId)) {
      throw new Error("Session already used");
    }
    exchangedSessionIds.add(sessionId);
    await initDatabase();
    const result = await api.createSession(sessionId);
    // Store the 7-day token in the secure store ONLY.
    await storage.secureSet(STORAGE_KEYS.sessionToken, result.session_token);
    const row = await upsertFromBackend(result.user);
    return activate(row);
  },

  // ---- Session lifecycle ----------------------------------------------------
  async getCurrentUser(): Promise<User | null> {
    await initDatabase();
    const id = await storage.getItem<string>(STORAGE_KEYS.activeUserId, "");
    if (!id) return null;
    const row = await UserRepository.getById(id);
    if (!row) return null;
    setActiveUserId(row.id);
    return rowToUser(row);
  },

  async isAuthenticated(): Promise<boolean> {
    const method = await storage.getItem<string>(STORAGE_KEYS.authMethod, "");
    const id = await storage.getItem<string>(STORAGE_KEYS.activeUserId, "");
    return !!method && !!id;
  },

  /**
   * Restore a session on app start. Offline-first: if the network is
   * unavailable for a Google user we fall back to the cached local profile.
   */
  async restoreSession(): Promise<User | null> {
    await initDatabase();
    const method = (await storage.getItem<string>(STORAGE_KEYS.authMethod, "")) as
      | AuthMethod
      | "";

    if (method === "demo") {
      if (!AUTH.devAuthEnabled) {
        await this.signOut();
        return null;
      }
      const row = await UserRepository.getById(AUTH.demoUserId);
      return row ? activate(row) : null;
    }

    if (method === "google") {
      const token = await storage.secureGet<string>(STORAGE_KEYS.sessionToken, "");
      if (!token) return null;
      try {
        const me = await api.me(token);
        const row = await upsertFromBackend(me);
        return activate(row);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await this.signOut();
          return null;
        }
        // Network/backend down -> offline fallback to cached local profile.
        const id = await storage.getItem<string>(STORAGE_KEYS.activeUserId, "");
        if (id) {
          const row = await UserRepository.getById(id);
          if (row) return activate(row);
        }
        return null;
      }
    }

    return null;
  },

  async refreshSession(): Promise<User | null> {
    const method = await storage.getItem<string>(STORAGE_KEYS.authMethod, "");
    if (method !== "google") return this.getCurrentUser();
    const token = await storage.secureGet<string>(STORAGE_KEYS.sessionToken, "");
    if (!token) return null;
    try {
      const me = await api.me(token);
      const row = await upsertFromBackend(me);
      return activate(row);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await this.signOut();
        return null;
      }
      return this.getCurrentUser();
    }
  },

  async signOut(): Promise<void> {
    const method = await storage.getItem<string>(STORAGE_KEYS.authMethod, "");
    if (method === "google") {
      const token = await storage.secureGet<string>(STORAGE_KEYS.sessionToken, "");
      if (token) {
        try {
          await api.logout(token);
        } catch {
          // best-effort server logout
        }
      }
    }
    await storage.secureRemove(STORAGE_KEYS.sessionToken);
    await storage.removeItem(STORAGE_KEYS.authMethod);
    await storage.removeItem(STORAGE_KEYS.activeUserId);
    setActiveUserId(null);
    // NOTE: local SQLite data is intentionally preserved across logout.
  },
};
