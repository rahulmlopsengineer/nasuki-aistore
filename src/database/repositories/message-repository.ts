// Message data-access. `status` is the persisted column; the UI `state` is
// derived from it via mappers.

import { Message, MessageRole, MessageStatus } from "@/src/types";
import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor, initDatabase } from "../client";
import { mapMessage, statusToState } from "../mappers";
import { MessageRow } from "../types";

export interface AddMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  modelId?: string | null;
  tokenCount?: number | null;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
}

export const MessageRepository = {
  async addMessage(input: AddMessageInput): Promise<Message> {
    await initDatabase();
    const db = getExecutor();
    const now = nowIso();
    const id = uid("m");
    const status: MessageStatus = input.status ?? "completed";

    try {
      await db.runAsync(
        `INSERT INTO messages
          (id, conversation_id, role, content, status, model_id, token_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.conversationId,
          input.role,
          input.content,
          status,
          input.modelId ?? null,
          input.tokenCount ?? null,
          now,
          now,
        ],
      );
    } catch (e) {
      console.warn("[NASUKI][DB] Failed to insert message into SQLite:", e);
    }

    const row = await db.getFirstAsync<MessageRow>("SELECT * FROM messages WHERE id = ?", [id]);
    if (row) {
      return mapMessage(row);
    }

    return {
      id,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      status,
      state: statusToState(status),
      modelId: input.modelId ?? null,
      tokenCount: input.tokenCount ?? null,
      createdAt: now,
      updatedAt: now,
    };
  },

  async getMessages(conversationId: string, opts: GetMessagesOptions = {}): Promise<Message[]> {
    await initDatabase();
    const limit = opts.limit ?? 200;
    const offset = opts.offset ?? 0;
    const rows = await getExecutor().getAllAsync<MessageRow>(
      `SELECT * FROM messages WHERE conversation_id = ?
        ORDER BY datetime(created_at) ASC, rowid ASC LIMIT ? OFFSET ?`,
      [conversationId, limit, offset],
    );
    return (rows ?? []).map(mapMessage);
  },

  async updateMessage(
    id: string,
    patch: Partial<{ content: string; status: MessageStatus; tokenCount: number | null }>,
  ): Promise<void> {
    await initDatabase();
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.content !== undefined) { sets.push("content = ?"); params.push(patch.content); }
    if (patch.status !== undefined) { sets.push("status = ?"); params.push(patch.status); }
    if (patch.tokenCount !== undefined) { sets.push("token_count = ?"); params.push(patch.tokenCount); }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);
    await getExecutor().runAsync(`UPDATE messages SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  async deleteMessage(id: string): Promise<void> {
    await initDatabase();
    await getExecutor().runAsync("DELETE FROM messages WHERE id = ?", [id]);
  },

  async deleteConversationMessages(conversationId: string): Promise<void> {
    await initDatabase();
    await getExecutor().runAsync("DELETE FROM messages WHERE conversation_id = ?", [conversationId]);
  },
};
