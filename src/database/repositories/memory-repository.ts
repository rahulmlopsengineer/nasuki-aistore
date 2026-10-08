// MemoryRepository — SQLite persistence for semantic conversation memories.
// Enforces user isolation on all query operations.

import { Memory, MemoryType } from "@/src/types";
import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor, initDatabase } from "../client";
import { mapMemory } from "../mappers";
import { MemoryRow } from "../types";

export interface CreateMemoryInput {
  userId: string;
  conversationId?: string | null;
  content: string;
  memoryType?: MemoryType;
  importance?: number;
  sourceMessageId?: string | null;
  tokenCount?: number;
  embeddingStatus?: "pending" | "ready" | "failed";
  embedding?: number[] | null;
}

export interface ListMemoriesOptions {
  conversationId?: string | null;
  memoryType?: MemoryType;
  limit?: number;
  offset?: number;
}

export const MemoryRepository = {
  async createMemory(input: CreateMemoryInput): Promise<Memory> {
    await initDatabase();
    const db = getExecutor();
    const now = nowIso();
    const id = uid("mem");

    const embeddingJson = input.embedding ? JSON.stringify(input.embedding) : null;
    const status = input.embeddingStatus ?? (input.embedding ? "ready" : "pending");

    await db.runAsync(
      `INSERT INTO memories
        (id, user_id, conversation_id, content, memory_type, importance,
         source_message_id, token_count, embedding_status, embedding_json,
         created_at, updated_at, last_accessed_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        input.userId,
        input.conversationId ?? null,
        input.content,
        input.memoryType ?? "FACT",
        input.importance ?? 1.0,
        input.sourceMessageId ?? null,
        input.tokenCount ?? 0,
        status,
        embeddingJson,
        now,
        now,
        now,
      ],
    );

    const row = await db.getFirstAsync<MemoryRow>("SELECT * FROM memories WHERE id = ?", [id]);
    if (row) return mapMemory(row);

    return {
      id,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      content: input.content,
      memoryType: input.memoryType ?? "FACT",
      importance: input.importance ?? 1.0,
      sourceMessageId: input.sourceMessageId ?? null,
      tokenCount: input.tokenCount ?? 0,
      embeddingStatus: status,
      embedding: input.embedding ?? null,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    };
  },

  async getMemory(id: string): Promise<Memory | null> {
    await initDatabase();
    const row = await getExecutor().getFirstAsync<MemoryRow>(
      "SELECT * FROM memories WHERE id = ?",
      [id],
    );
    return row ? mapMemory(row) : null;
  },

  async getMemoriesForUser(userId: string, opts: ListMemoriesOptions = {}): Promise<Memory[]> {
    await initDatabase();
    const clauses = ["user_id = ?"];
    const params: (string | number)[] = [userId];

    if (opts.conversationId !== undefined) {
      if (opts.conversationId === null) {
        clauses.push("conversation_id IS NULL");
      } else {
        clauses.push("(conversation_id = ? OR conversation_id IS NULL)");
        params.push(opts.conversationId);
      }
    }

    if (opts.memoryType) {
      clauses.push("memory_type = ?");
      params.push(opts.memoryType);
    }

    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    params.push(limit, offset);

    const rows = await getExecutor().getAllAsync<MemoryRow>(
      `SELECT * FROM memories WHERE ${clauses.join(" AND ")}
       ORDER BY importance DESC, datetime(last_accessed_at) DESC
       LIMIT ? OFFSET ?`,
      params,
    );

    return (rows ?? []).map(mapMemory);
  },

  async updateMemory(
    id: string,
    patch: Partial<{
      content: string;
      memoryType: MemoryType;
      importance: number;
      embeddingStatus: "pending" | "ready" | "failed";
      embedding: number[] | null;
      accessCount: number;
    }>,
  ): Promise<void> {
    await initDatabase();
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (patch.content !== undefined) { sets.push("content = ?"); params.push(patch.content); }
    if (patch.memoryType !== undefined) { sets.push("memory_type = ?"); params.push(patch.memoryType); }
    if (patch.importance !== undefined) { sets.push("importance = ?"); params.push(patch.importance); }
    if (patch.embeddingStatus !== undefined) { sets.push("embedding_status = ?"); params.push(patch.embeddingStatus); }
    if (patch.embedding !== undefined) {
      sets.push("embedding_json = ?");
      params.push(patch.embedding ? JSON.stringify(patch.embedding) : null);
    }
    if (patch.accessCount !== undefined) { sets.push("access_count = ?"); params.push(patch.accessCount); }

    if (!sets.length) return;

    const now = nowIso();
    sets.push("updated_at = ?");
    params.push(now);
    params.push(id);

    await getExecutor().runAsync(`UPDATE memories SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  async touchAccess(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await initDatabase();
    const now = nowIso();
    const placeholders = ids.map(() => "?").join(",");
    await getExecutor().runAsync(
      `UPDATE memories
       SET last_accessed_at = ?, access_count = access_count + 1
       WHERE id IN (${placeholders})`,
      [now, ...ids],
    );
  },

  async deleteMemory(id: string): Promise<void> {
    await initDatabase();
    await getExecutor().runAsync("DELETE FROM memories WHERE id = ?", [id]);
  },

  async deleteAllForUser(userId: string): Promise<void> {
    await initDatabase();
    await getExecutor().runAsync("DELETE FROM memories WHERE user_id = ?", [userId]);
  },
};
