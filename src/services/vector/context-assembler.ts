// ContextAssembler — formats and compresses system instructions,
// retrieved semantic memories, document context, and working memory into
// a unified prompt respecting the token budget.

import { VECTOR_CONFIG } from "@/src/constants/config";
import { Memory, Message } from "@/src/types";
import { estimateTokens } from "../local-inference/context-builder";
import { PromptFormatter } from "../local-inference/prompt-formatter";
import { AdaptiveContextBudget, VectorSearchResult } from "./types";

export interface ContextAssembleOptions {
  systemPrompt?: string;
  summary?: string | null;
  workingMemory: Message[];
  retrievedCandidates: VectorSearchResult[];
  documentChunks?: string[];
  currentUserMessage: string;
  budget: AdaptiveContextBudget;
}

export const ContextAssembler = {
  assembleContext(options: ContextAssembleOptions) {
    const { budget, currentUserMessage } = options;
    const systemPrompt = options.systemPrompt ?? "You are NASUKI, a private offline AI assistant.";
    const summary = options.summary?.trim() || undefined;

    // Filter candidates below minimum relevance threshold
    const minScore = VECTOR_CONFIG.minRelevanceScoreThreshold; // 0.35
    const filteredMemories: Memory[] = options.retrievedCandidates
      .filter((c) => c.finalScore >= minScore)
      .slice(0, budget.maxRetrievedMemories)
      .map((c) => c.item);

    // Filter document chunks
    const docContext = options.documentChunks?.filter(Boolean).join("\n") || undefined;

    // Working memory selection (recent turns)
    const maxWorkingTurns = budget.workingMemoryTurns;
    let selectedWorkingMemory = options.workingMemory.slice(-maxWorkingTurns * 2);
    let truncated = false;

    // Format memories string
    const memoriesText = filteredMemories.length > 0
      ? filteredMemories.map((m) => `[Memory - ${m.memoryType}]: ${m.content}`).join("\n")
      : undefined;

    // Combine retrieved context (memories + documents)
    const combinedRetrievedContext = [memoriesText, docContext].filter(Boolean).join("\n\n") || undefined;

    while (true) {
      const formattedPrompt = PromptFormatter.format({
        systemPrompt,
        summary,
        retrievedContext: combinedRetrievedContext,
        history: selectedWorkingMemory.map((m) => ({ role: m.role, content: m.content })),
        currentUserMessage,
      });

      const estimatedTokens = estimateTokens(formattedPrompt);

      if (estimatedTokens <= budget.inputBudgetTokens || selectedWorkingMemory.length === 0) {
        if (selectedWorkingMemory.length < options.workingMemory.length) {
          truncated = true;
        }

        return {
          prompt: formattedPrompt,
          systemPrompt,
          workingMemory: selectedWorkingMemory,
          retrievedMemories: filteredMemories,
          retrievedDocuments: options.documentChunks ?? [],
          currentUserMessage,
          estimatedTokens,
          truncated,
        };
      }

      // Truncate oldest turn from working memory
      selectedWorkingMemory.shift();
      truncated = true;
    }
  },
};
