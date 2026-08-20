// ChatService — orchestrates the chat UI against the SQLite repositories,
// scoped to the active user. The assistant reply is still a MOCK in Phase 2
// (no Gemma / LLM inference yet), but both the user message and the mock
// assistant message are PERSISTED so history survives an app restart.

import {
  ConversationRepository,
  MessageRepository,
} from "@/src/database";
import { Conversation, Message, MessageStatus } from "@/src/types";
import { getActiveUserId, requireActiveUserId } from "./active-user";

const CANNED = [
  "Great question! Here's a clear breakdown you can use right away.",
  "Sure — let me walk you through it step by step so it sticks.",
  "Here's a concise answer, plus a tip most people miss.",
  "Absolutely. I'd approach it like this, keeping things simple.",
];

export const ChatService = {
  async listConversations(): Promise<Conversation[]> {
    const userId = getActiveUserId();
    if (!userId) return [];
    return ConversationRepository.getConversations(userId, { limit: 100 });
  },

  async getConversation(id: string): Promise<Conversation | null> {
    return ConversationRepository.getConversation(id);
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    return MessageRepository.getMessages(conversationId, { limit: 500 });
  },

  async createConversation(modelId: string): Promise<Conversation> {
    const userId = requireActiveUserId();
    return ConversationRepository.createConversation({ userId, modelId });
  },

  async addUserMessage(conversationId: string, content: string): Promise<Message> {
    const msg = await MessageRepository.addMessage({
      conversationId,
      role: "user",
      content,
      status: "completed",
    });
    await ConversationRepository.touch(conversationId, content);
    return msg;
  },

  async addAssistantMessage(
    conversationId: string,
    content: string,
    status: MessageStatus = "generating",
    modelId?: string | null,
  ): Promise<Message> {
    return MessageRepository.addMessage({
      conversationId,
      role: "assistant",
      content,
      status,
      modelId: modelId ?? null,
    });
  },

  async completeAssistantMessage(
    conversationId: string,
    messageId: string,
    content: string,
    status: MessageStatus = "completed",
  ): Promise<void> {
    await MessageRepository.updateMessage(messageId, { content, status });
    if (status === "completed") {
      await ConversationRepository.touch(conversationId, content);
    }
  },

  async updateMessage(
    messageId: string,
    patch: Partial<{ content: string; status: MessageStatus }>,
  ): Promise<void> {
    await MessageRepository.updateMessage(messageId, patch);
  },

  async renameConversation(id: string, title: string): Promise<void> {
    await ConversationRepository.renameConversation(id, title);
  },

  async togglePin(id: string): Promise<void> {
    const convo = await ConversationRepository.getConversation(id);
    if (!convo) return;
    await ConversationRepository.pinConversation(id, !convo.pinned);
  },

  async deleteConversation(id: string): Promise<void> {
    await ConversationRepository.deleteConversation(id);
  },

  /** MOCK assistant reply generator (placeholder for Phase 3 on-device LLM). */
  generateMockReply(userContent: string): string {
    const reply = CANNED[Math.floor(Math.random() * CANNED.length)];
    return `${reply}\n\nYou asked: "${userContent.slice(0, 120)}"`;
  },
};
