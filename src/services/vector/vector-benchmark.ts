// Benchmark utility for NASUKI Adaptive Vector Context Engine.
// Measures embedding generation speed, vector search latency, relevance scoring,
// context assembly latency, and memory extraction performance.

import { ContextEngine } from "./context-engine";
import { localEmbeddingEngine } from "./embedding-service";
import { MemoryExtractor } from "./memory-extractor";
import { QueryAnalyzer } from "./query-analyzer";
import { defaultVectorStore } from "./vector-store";

export interface VectorBenchmarkResult {
  embeddingMs: number;
  searchMs: number;
  queryAnalysisMs: number;
  contextAssemblyMs: number;
  memoryExtractionMs: number;
  totalEngineMs: number;
  memoriesInStore: number;
  success: boolean;
  error?: string;
}

export const VectorBenchmark = {
  async runBenchmark(userId: string = "demo-user"): Promise<VectorBenchmarkResult> {
    try {
      const sampleQuery = "What model and architecture did I decide to use for NASUKI?";
      const userText = "Remember that NASUKI uses Gemma 2B GGUF with llama.rn on 4GB Android devices.";
      const assistantText = "Got it! I will remember that NASUKI targets 4GB RAM devices running Gemma 2B on-device.";

      // 1. Measure Embedding Latency
      const embedStart = Date.now();
      const embedding = await localEmbeddingEngine.generateEmbedding(sampleQuery);
      const embeddingMs = Date.now() - embedStart;

      // 2. Measure Memory Extraction & Storage
      const extractStart = Date.now();
      await MemoryExtractor.extractAndStoreMemory(userId, "cnv-bench", userText, assistantText, "m-bench-1");
      const memoryExtractionMs = Date.now() - extractStart;

      // 3. Measure Query Analysis
      const analysisStart = Date.now();
      const decision = QueryAnalyzer.analyzeQuery(sampleQuery, 5);
      const queryAnalysisMs = Date.now() - analysisStart;

      // 4. Measure Vector Store Search
      const searchStart = Date.now();
      const candidates = await defaultVectorStore.search(embedding, { userId, topK: 5 });
      const searchMs = Date.now() - searchStart;

      // 5. Measure Full Context Engine Pipeline
      const engineStart = Date.now();
      const result = await ContextEngine.buildAdaptiveContext({
        userId,
        conversationId: "cnv-bench",
        messages: [
          { id: "m1", conversationId: "cnv-bench", role: "user", content: "Hi NASUKI", state: "completed", createdAt: new Date().toISOString() },
          { id: "m2", conversationId: "cnv-bench", role: "assistant", content: "Hello! How can I help you?", state: "completed", createdAt: new Date().toISOString() },
        ],
        currentUserMessage: sampleQuery,
      });
      const contextAssemblyMs = Date.now() - engineStart;

      const count = await defaultVectorStore.count({ userId });

      console.log(
        `[NASUKI][VECTOR_BENCHMARK] Results:\n` +
        `  Embedding Latency: ${embeddingMs}ms\n` +
        `  Memory Extraction Latency: ${memoryExtractionMs}ms\n` +
        `  Query Analysis Latency: ${queryAnalysisMs}ms\n` +
        `  Vector Search Latency: ${searchMs}ms\n` +
        `  Context Assembly Latency: ${contextAssemblyMs}ms\n` +
        `  Total Engine Latency: ${contextAssemblyMs}ms\n` +
        `  Total Memories in Store: ${count}\n` +
        `  Prompt Tokens Estimated: ${result.estimatedTokens} / ${result.budget.inputBudgetTokens}`
      );

      return {
        embeddingMs,
        searchMs,
        queryAnalysisMs,
        contextAssemblyMs,
        memoryExtractionMs,
        totalEngineMs: contextAssemblyMs,
        memoriesInStore: count,
        success: true,
      };
    } catch (e: any) {
      console.error("[NASUKI][VECTOR_BENCHMARK] Benchmark failed:", e);
      return {
        embeddingMs: 0,
        searchMs: 0,
        queryAnalysisMs: 0,
        contextAssemblyMs: 0,
        memoryExtractionMs: 0,
        totalEngineMs: 0,
        memoriesInStore: 0,
        success: false,
        error: e.message,
      };
    }
  },
};
