// User data-access. Local users are keyed by a stable `id`:
//   - Google accounts -> backend user_id (also stored as remote_id)
//   - Demo account     -> a fixed local id
// Upsert-by-id guarantees the same account never duplicates on re-login.

import { nowIso } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { AuthProvider, UserRow } from "../types";

export interface UpsertUserInput {
  id: string;
  remoteId?: string | null;
  name: string;
  email?: string | null;
  profileImage?: string | null;
  authProvider: AuthProvider;
  isDemoUser: boolean;
}

export const UserRepository = {
  async getById(id: string): Promise<UserRow | null> {
    return getExecutor().getFirstAsync<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
  },

  async getByRemoteId(remoteId: string): Promise<UserRow | null> {
    return getExecutor().getFirstAsync<UserRow>("SELECT * FROM users WHERE remote_id = ?", [
      remoteId,
    ]);
  },

  async upsert(input: UpsertUserInput): Promise<UserRow> {
    const db = getExecutor();
    const now = nowIso();
    const existing = await this.getById(input.id);
    if (existing) {
      await db.runAsync(
        `UPDATE users SET remote_id = ?, name = ?, email = ?, profile_image = ?,
         auth_provider = ?, is_demo_user = ?, updated_at = ? WHERE id = ?`,
        [
          input.remoteId ?? null,
          input.name,
          input.email ?? null,
          input.profileImage ?? null,
          input.authProvider,
          input.isDemoUser ? 1 : 0,
          now,
          input.id,
        ],
      );
    } else {
      await db.runAsync(
        `INSERT INTO users (id, remote_id, name, email, profile_image, auth_provider,
         is_demo_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.remoteId ?? null,
          input.name,
          input.email ?? null,
          input.profileImage ?? null,
          input.authProvider,
          input.isDemoUser ? 1 : 0,
          now,
          now,
        ],
      );
    }
    const row = await this.getById(input.id);
    if (!row) throw new Error("Failed to upsert user");
    return row;
  },

  async deleteById(id: string): Promise<void> {
    await getExecutor().runAsync("DELETE FROM users WHERE id = ?", [id]);
  },
};
