// Row (snake_case) -> domain (camelCase) mappers + message status/state bridge.

import {
  ChatMessageState,
  Conversation,
  ConversationMode,
  Memory,
  MemoryType,
  Message,
  MessageRole,
  MessageStatus,
} from "@/src/types";
import { ConversationRow, MemoryRow, MessageRow } from "./types";

export function statusToState(status: MessageStatus): ChatMessageState {
  switch (status) {
    case "generating":
      return "generating";
    case "failed":
      return "error";
    case "pending":
      return "sending";
    case "completed":
    default:
      return "completed";
  }
}

export function stateToStatus(state: ChatMessageState): MessageStatus {
  switch (state) {
    case "sending":
      return "pending";
    case "typing":
    case "generating":
      return "generating";
    case "error":
      return "failed";
    case "stopped":
    case "completed":
    default:
      return "completed";
  }
}

export function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    modelId: row.model_id ?? "",
    mode: row.mode as ConversationMode,
    lastMessage: row.last_message ?? "",
    messageCount: row.message_count ?? 0,
    pinned: !!row.is_pinned,
    isArchived: !!row.is_archived,
    isPrivate: !!row.is_private,
    summary: row.summary ?? null,
    summaryUpdatedAt: row.summary_updated_at ?? null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export function mapMessage(row: MessageRow): Message {
  const status = row.status as MessageStatus;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    status,
    state: statusToState(status),
    modelId: row.model_id,
    tokenCount: row.token_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMemory(row: MemoryRow): Memory {
  let embedding: number[] | null = null;
  if (row.embedding_json) {
    try {
      embedding = JSON.parse(row.embedding_json);
    } catch {
      embedding = null;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    content: row.content,
    memoryType: (row.memory_type as MemoryType) ?? "FACT",
    importance: row.importance ?? 1.0,
    sourceMessageId: row.source_message_id,
    tokenCount: row.token_count ?? 0,
    embeddingStatus: (row.embedding_status as "pending" | "ready" | "failed") ?? "pending",
    embedding,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count ?? 0,
  };
}
