// ConversationSummarizer — manages long-term conversation summarization.
// Enforces event-driven updates (never during active inference) to preserve
// the single-generation rule and prevent battery/thermal overhead.

import { ConversationRepository, MessageRepository } from "@/src/database";
import { estimateTokens } from "./context-builder";

export interface SummarizerThresholdConfig {
  minMessageCount?: number; // default 6
  maxHistoryTokens?: number; // default 80
}

export const ConversationSummarizer = {
  shouldSummarize(
    messageCount: number,
    estimatedHistoryTokens: number,
    config?: SummarizerThresholdConfig
  ): boolean {
    const minMsgs = config?.minMessageCount ?? 6;
    const maxTokens = config?.maxHistoryTokens ?? 80;
    return messageCount >= minMsgs || estimatedHistoryTokens > maxTokens;
  },

  /**
   * Generates and persists a compact conversation summary based on message history.
   * Runs asynchronously after user completion without blocking UI streaming.
   */
  async summarizeConversation(conversationId: string): Promise<string | null> {
    try {
      const messages = await MessageRepository.getMessages(conversationId, { limit: 50 });
      if (!messages || messages.length === 0) return null;

      const userMessages = messages.filter((m) => m.role === "user");
      if (userMessages.length === 0) return null;

      const topics = userMessages
        .slice(-4)
        .map((m) => m.content.replace(/\s+/g, " ").trim().slice(0, 70))
        .filter(Boolean)
        .join("; ");

      const summary = `User topics: ${topics}. Total messages: ${messages.length}.`;
      await ConversationRepository.saveSummary(conversationId, summary);
      console.log(`[NASUKI][SUMMARY] Updated conversation summary for ${conversationId}:`, summary);
      return summary;
    } catch (e) {
      console.error("[NASUKI][SUMMARY] Failed to summarize conversation:", e);
      return null;
    }
  },
};
