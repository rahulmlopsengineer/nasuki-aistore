// Diagnostics and RAG retrieval benchmark utility for NASUKI.

import { DocumentRepository } from "@/src/database";
import { HybridDocumentRetriever } from "./hybrid-retriever";

export interface RagBenchmarkResult {
  query: string;
  totalUserDocuments: number;
  totalChunksInStore: number;
  retrievedChunksCount: number;
  retrievalTimeMs: number;
  topCandidateScores: number[];
  success: boolean;
  error?: string;
}

export const RagDebug = {
  async runRagBenchmark(
    query: string = "What are the architectural requirements and RAM limits for NASUKI?",
    userId: string = "demo-user"
  ): Promise<RagBenchmarkResult> {
    const startTime = Date.now();
    try {
      const docs = await DocumentRepository.listDocuments(userId);
      const chunks = await DocumentRepository.getAllChunksForUser(userId);

      const retrieved = await HybridDocumentRetriever.retrieveHybrid(query, {
        userId,
        limit: 4,
        expandAdjacent: true,
      });

      const retrievalTimeMs = Date.now() - startTime;
      const scores = retrieved.map((r) => r.score ?? 0);

      console.log(
        `[NASUKI][RAG_BENCHMARK] Summary:\n` +
        `  Query: "${query}"\n` +
        `  Total User Documents: ${docs.length}\n` +
        `  Total Chunks in Store: ${chunks.length}\n` +
        `  Retrieved Chunks: ${retrieved.length}\n` +
        `  Top Scores: [${scores.map((s) => s.toFixed(2)).join(", ")}]\n` +
        `  Retrieval Time: ${retrievalTimeMs}ms`
      );

      return {
        query,
        totalUserDocuments: docs.length,
        totalChunksInStore: chunks.length,
        retrievedChunksCount: retrieved.length,
        retrievalTimeMs,
        topCandidateScores: scores,
        success: true,
      };
    } catch (e: any) {
      console.error("[NASUKI][RAG_BENCHMARK] RAG benchmark error:", e);
      return {
        query,
        totalUserDocuments: 0,
        totalChunksInStore: 0,
        retrievedChunksCount: 0,
        retrievalTimeMs: Date.now() - startTime,
        topCandidateScores: [],
        success: false,
        error: e.message,
      };
    }
  },
};
