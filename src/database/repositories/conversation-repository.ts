// Conversation data-access — always scoped by user_id for isolation.

import { Conversation, ConversationMode } from "@/src/types";
import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { mapConversation } from "../mappers";
import { ConversationRow } from "../types";

export interface CreateConversationInput {
  userId: string;
  modelId?: string | null;
  title?: string;
  mode?: ConversationMode;
  isPrivate?: boolean;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export const ConversationRepository = {
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const db = getExecutor();
    const now = nowIso();
    const id = uid("cnv");
    await db.runAsync(
      `INSERT INTO conversations
        (id, user_id, title, model_id, mode, last_message, message_count,
         is_pinned, is_archived, is_private, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', 0, 0, 0, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.title ?? "New chat",
        input.modelId ?? null,
        input.mode ?? "offline",
        input.isPrivate ? 1 : 0,
        now,
        now,
      ],
    );
    const convo = await this.getConversation(id);
    if (!convo) throw new Error("Failed to create conversation");
    return convo;
  },

  async getConversation(id: string): Promise<Conversation | null> {
    const row = await getExecutor().getFirstAsync<ConversationRow>(
      "SELECT * FROM conversations WHERE id = ?",
      [id],
    );
    return row ? mapConversation(row) : null;
  },

  async getConversations(userId: string, opts: ListOptions = {}): Promise<Conversation[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const archivedClause = opts.includeArchived ? "" : "AND is_archived = 0";
    const rows = await getExecutor().getAllAsync<ConversationRow>(
      `SELECT * FROM conversations
        WHERE user_id = ? ${archivedClause}
        ORDER BY is_pinned DESC, datetime(updated_at) DESC
        LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    return rows.map(mapConversation);
  },

  async updateConversation(
    id: string,
    patch: Partial<{
      title: string;
      modelId: string | null;
      mode: ConversationMode;
      isPinned: boolean;
      isArchived: boolean;
      isPrivate: boolean;
      lastMessage: string;
      messageCount: number;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.title !== undefined) { sets.push("title = ?"); params.push(patch.title); }
    if (patch.modelId !== undefined) { sets.push("model_id = ?"); params.push(patch.modelId); }
    if (patch.mode !== undefined) { sets.push("mode = ?"); params.push(patch.mode); }
    if (patch.isPinned !== undefined) { sets.push("is_pinned = ?"); params.push(patch.isPinned ? 1 : 0); }
    if (patch.isArchived !== undefined) { sets.push("is_archived = ?"); params.push(patch.isArchived ? 1 : 0); }
    if (patch.isPrivate !== undefined) { sets.push("is_private = ?"); params.push(patch.isPrivate ? 1 : 0); }
    if (patch.lastMessage !== undefined) { sets.push("last_message = ?"); params.push(patch.lastMessage); }
    if (patch.messageCount !== undefined) { sets.push("message_count = ?"); params.push(patch.messageCount); }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    await getExecutor().runAsync(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  async renameConversation(id: string, title: string): Promise<void> {
    await this.updateConversation(id, { title });
  },

  async pinConversation(id: string, pinned: boolean): Promise<void> {
    await this.updateConversation(id, { isPinned: pinned });
  },

  async touch(id: string, lastMessage: string): Promise<void> {
    const db = getExecutor();
    await db.runAsync(
      `UPDATE conversations
         SET last_message = ?, message_count = (
           SELECT COUNT(*) FROM messages WHERE conversation_id = ?
         ), updated_at = ?
       WHERE id = ?`,
      [lastMessage, id, nowIso(), id],
    );
  },

  async deleteConversation(id: string): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", [id]);
      await db.runAsync("DELETE FROM conversations WHERE id = ?", [id]);
    });
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM messages WHERE conversation_id IN
          (SELECT id FROM conversations WHERE user_id = ?)`,
        [userId],
      );
      await db.runAsync("DELETE FROM conversations WHERE user_id = ?", [userId]);
    });
  },
};
