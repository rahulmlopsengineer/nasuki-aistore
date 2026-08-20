// Row (snake_case) -> domain (camelCase) mappers + message status/state bridge.

import {
  ChatMessageState,
  Conversation,
  ConversationMode,
  Message,
  MessageRole,
  MessageStatus,
} from "@/src/types";
import { ConversationRow, MessageRow } from "./types";

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
