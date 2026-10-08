// ContextEngine — the central orchestrator for NASUKI Adaptive Vector Context.
// Orchestrates query analysis, semantic retrieval, relevance ranking,
// resource-aware context budgeting, context assembly, and background memory extraction.

import { Message } from "@/src/types";
import { DocumentContextRetriever } from "../rag/context-retriever";
import { ContextAssembler } from "./context-assembler";
import { ContextBudgetManager } from "./context-budget-manager";
import { localEmbeddingEngine } from "./embedding-service";
import { MemoryExtractor } from "./memory-extractor";
import { QueryAnalyzer } from "./query-analyzer";
import { RelevanceScorer } from "./relevance-scorer";
import { AdaptiveContextResult, VectorSearchResult } from "./types";
import { defaultVectorStore } from "./vector-store";

export interface BuildAdaptiveContextOptions {
  userId: string;
  conversationId: string;
  summary?: string | null;
  systemPrompt?: string;
  messages: Message[];
  currentUserMessage: string;
}

export const ContextEngine = {
  async buildAdaptiveContext(
    options: BuildAdaptiveContextOptions,
  ): Promise<AdaptiveContextResult> {
    const startTime = Date.now();
    const { userId, conversationId, summary, systemPrompt, messages, currentUserMessage } = options;

    // 1. Get Device RAM-aware Context Budget
    const budget = await ContextBudgetManager.getAdaptiveBudget();

    // 2. Query Analysis
    const decision = QueryAnalyzer.analyzeQuery(currentUserMessage, messages.length);

    let retrievedCandidates: VectorSearchResult[] = [];
    let documentChunks: string[] = [];

    if (decision.shouldRetrieve && decision.searchQuery && budget.ramState !== "CRITICAL") {
      try {
        const queryEmbedding = await localEmbeddingEngine.generateEmbedding(decision.searchQuery);

        // Vector search in semantic conversation memories
        const candidates = await defaultVectorStore.search(queryEmbedding, {
          userId,
          conversationId,
          topK: budget.maxRetrievedMemories * 2,
        });

        // Relevance Ranking (similarity + importance + recency + conversation relevance)
        retrievedCandidates = RelevanceScorer.rankCandidates(candidates, conversationId);

        // Retrieve relevant Document Chunks (RAG)
        const docResults = await DocumentContextRetriever.retrieve(decision.searchQuery, { limit: 2 });
        documentChunks = docResults.map((d) => `[Doc Chunk (${d.source})]: ${d.text}`);
      } catch (e) {
        console.warn("[NASUKI][VECTOR] Semantic retrieval fallback to recent working context:", e);
      }
    }

    // 3. Assemble and compress final context
    const assembled = ContextAssembler.assembleContext({
      systemPrompt,
      summary,
      workingMemory: messages,
      retrievedCandidates,
      documentChunks,
      currentUserMessage,
      budget,
    });

    const totalTimeMs = Date.now() - startTime;

    // Development & Diagnostic Log
    console.log(
      `[NASUKI][VECTOR_DEBUG]\n` +
      `  RAM State: ${budget.ramState}\n` +
      `  Budget Limit Tokens: ${budget.totalContextLimitTokens}\n` +
      `  Input Tokens: ${assembled.estimatedTokens} / ${budget.inputBudgetTokens}\n` +
      `  Reserved Output Tokens: ${budget.reservedOutputTokens}\n` +
      `  Retrieval Decision: ${decision.shouldRetrieve} (${decision.reason})\n` +
      `  Retrieved Memories Selected: ${assembled.retrievedMemories.length}\n` +
      `  Retrieved Documents Selected: ${assembled.retrievedDocuments.length}\n` +
      `  Working Memory Turns Kept: ${assembled.workingMemory.length / 2}\n` +
      `  Context Assembly Time: ${totalTimeMs}ms`
    );

    return {
      prompt: assembled.prompt,
      systemPrompt: assembled.systemPrompt,
      workingMemory: assembled.workingMemory,
      retrievedMemories: assembled.retrievedMemories,
      retrievedDocuments: assembled.retrievedDocuments,
      currentUserMessage,
      estimatedTokens: assembled.estimatedTokens,
      budget,
      retrievalDecision: decision,
      truncated: assembled.truncated,
    };
  },

  /**
   * Asynchronous post-generation memory extraction.
   * Runs non-blocking after user response generation without slowing down streaming.
   */
  async processPostGenerationMemory(
    userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
    sourceMessageId?: string | null,
  ): Promise<void> {
    try {
      await MemoryExtractor.extractAndStoreMemory(
        userId,
        conversationId,
        userMessage,
        assistantMessage,
        sourceMessageId,
      );
    } catch (e) {
      console.warn("[NASUKI][VECTOR] Post-generation memory extraction error:", e);
    }
  },
};
