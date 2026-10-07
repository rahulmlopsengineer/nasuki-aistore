// ContextBuilder — enforces token budgets and message selection priority.
// Priority order:
//   1. System instructions
//   2. Conversation summary
//   3. Retrieved document context (RAG)
//   4. Most recent relevant messages fitting budget
//   5. Current user message (always preserved!)

import { Message } from "@/src/types";
import { PromptFormatter } from "./prompt-formatter";

export interface ContextBuilderOptions {
  conversationId?: string;
  systemPrompt?: string;
  summary?: string | null;
  retrievedContext?: string | null;
  messages: Message[];
  currentUserMessage: string;
  maxContextTokens?: number; // default n_ctx = 200
  reservedOutputTokens?: number; // default 72 tokens reserved for assistant generation
}

export interface BuiltContext {
  prompt: string;
  systemPrompt: string;
  summary?: string;
  retrievedContext?: string;
  recentMessages: Message[];
  currentUserMessage: string;
  estimatedTokens: number;
  inputBudgetTokens: number;
  reservedOutputTokens: number;
  contextLimit: number;
  truncated: boolean;
}

/**
 * Conservative token estimator.
 * Uses character density and word count to estimate token usage safely.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const baseChars = Math.ceil(text.length / 3.8);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(baseChars, Math.ceil(wordCount * 1.3));
}

export const ContextBuilder = {
  buildConversationContext(options: ContextBuilderOptions): BuiltContext {
    const contextLimit = options.maxContextTokens ?? 200;
    const reservedOutput = options.reservedOutputTokens ?? 72;
    const inputBudget = Math.max(contextLimit - reservedOutput, 50);

    const systemPrompt = options.systemPrompt ?? "You are NASUKI, a private offline AI assistant.";
    const summary = options.summary?.trim() || undefined;
    const retrievedContext = options.retrievedContext?.trim() || undefined;
    const currentUserMessage = options.currentUserMessage.trim();

    // Start with all messages
    let selectedMessages = [...options.messages];
    let truncated = false;

    while (true) {
      const formattedPrompt = PromptFormatter.format({
        systemPrompt,
        summary,
        retrievedContext,
        history: selectedMessages.map((m) => ({ role: m.role, content: m.content })),
        currentUserMessage,
      });

      const estimated = estimateTokens(formattedPrompt);

      if (estimated <= inputBudget || selectedMessages.length === 0) {
        if (selectedMessages.length < options.messages.length) {
          truncated = true;
        }

        const sysTokens = estimateTokens(systemPrompt);
        const summaryTokens = estimateTokens(summary ?? "");
        const retrievalTokens = estimateTokens(retrievedContext ?? "");
        const userTokens = estimateTokens(currentUserMessage);
        const historyTokens = estimateTokens(
          selectedMessages.map((m) => `${m.role}: ${m.content}`).join("\n")
        );

        console.log(
          `[NASUKI][CONTEXT] Context telemetry:\n` +
          `  summaryTokens=${summaryTokens}\n` +
          `  historyTokens=${historyTokens}\n` +
          `  retrievalTokens=${retrievalTokens}\n` +
          `  userTokens=${userTokens}\n` +
          `  reservedOutputTokens=${reservedOutput}\n` +
          `  totalEstimatedTokens=${estimated}\n` +
          `  contextLimit=${contextLimit}\n` +
          `  inputBudgetTokens=${inputBudget}\n` +
          `  historyMessagesUsed=${selectedMessages.length}/${options.messages.length}\n` +
          `  truncated=${truncated}`
        );

        return {
          prompt: formattedPrompt,
          systemPrompt,
          summary,
          retrievedContext,
          recentMessages: selectedMessages,
          currentUserMessage,
          estimatedTokens: estimated,
          inputBudgetTokens: inputBudget,
          reservedOutputTokens: reservedOutput,
          contextLimit,
          truncated,
        };
      }

      // Truncate oldest raw message first
      selectedMessages.shift();
      truncated = true;
    }
  },
};
