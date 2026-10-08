// HybridDocumentRetriever — local hybrid semantic vector + keyword RAG retriever.
// Merges vector similarity and keyword relevance, expands adjacent chunks when
// high relevance requires contiguous context, and enforces user isolation.

import { DocumentRepository } from "@/src/database";
import { DocumentChunkRow } from "@/src/database/types";
import { localEmbeddingEngine } from "../vector/embedding-service";
import { cosineSimilarity } from "../vector/vector-store";
import { ContextChunk } from "./context-retriever";

export interface HybridRetrievalOptions {
  userId?: string;
  documentId?: string | null;
  limit?: number; // default 4
  minScore?: number; // default 0.25
  expandAdjacent?: boolean; // default true
}

export interface HybridCandidate {
  chunk: DocumentChunkRow;
  semanticScore: number;
  keywordScore: number;
  finalScore: number;
}

export const HybridDocumentRetriever = {
  async retrieveHybrid(
    query: string,
    options?: HybridRetrievalOptions
  ): Promise<ContextChunk[]> {
    if (!query || !query.trim()) return [];

    const userId = options?.userId ?? "demo-user";
    const documentId = options?.documentId ?? null;
    const limit = options?.limit ?? 4;
    const minScore = options?.minScore ?? 0.25;

    try {
      // Fetch all candidate chunks for current user (filtered by documentId if scoped)
      const allChunks = await DocumentRepository.getAllChunksForUser(userId, documentId);
      if (!allChunks || allChunks.length === 0) return [];

      // 1. Semantic Vector Search
      const queryEmbedding = await localEmbeddingEngine.generateEmbedding(query);

      // 2. Keyword Search Setup
      const queryTerms = query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);

      const scoredCandidates: HybridCandidate[] = [];

      for (const chunk of allChunks) {
        // Vector Score
        let semanticScore = 0;
        if (chunk.embedding_json) {
          try {
            const vec = JSON.parse(chunk.embedding_json);
            semanticScore = cosineSimilarity(queryEmbedding, vec);
          } catch {
            semanticScore = 0;
          }
        }

        // Keyword Score
        let keywordScore = 0;
        if (queryTerms.length > 0) {
          const textLower = chunk.text.toLowerCase();
          let matchCount = 0;
          for (const term of queryTerms) {
            if (textLower.includes(term)) matchCount++;
          }
          keywordScore = matchCount / queryTerms.length;
        }

        // Metadata Score (heading or section boost)
        let metadataScore = 0.2;
        if (chunk.heading && query.toLowerCase().includes(chunk.heading.toLowerCase())) {
          metadataScore = 1.0;
        }

        // Combined Hybrid Score
        const finalScore = 0.65 * semanticScore + 0.25 * keywordScore + 0.10 * metadataScore;

        if (finalScore >= minScore) {
          scoredCandidates.push({
            chunk,
            semanticScore,
            keywordScore,
            finalScore,
          });
        }
      }

      // Sort by final hybrid score
      scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
      const topCandidates = scoredCandidates.slice(0, limit);

      if (topCandidates.length === 0) return [];

      // 3. Optional Adjacent Chunk Expansion for top high-confidence matches
      const selectedChunkMap = new Map<string, DocumentChunkRow>();

      for (const candidate of topCandidates) {
        selectedChunkMap.set(candidate.chunk.id, candidate.chunk);

        // If high relevance (>0.60) and adjacent expansion enabled
        if (candidate.finalScore > 0.60 && options?.expandAdjacent !== false) {
          const adjChunks = allChunks.filter(
            (c) =>
              c.document_id === candidate.chunk.document_id &&
              Math.abs(c.chunk_index - candidate.chunk.chunk_index) === 1
          );
          for (const adj of adjChunks) {
            if (!selectedChunkMap.has(adj.id)) {
              selectedChunkMap.set(adj.id, adj);
            }
          }
        }
      }

      const finalChunks = Array.from(selectedChunkMap.values());

      console.log(
        `[NASUKI][RAG_DEBUG] Hybrid Retrieval Results:\n` +
        `  Query: "${query.slice(0, 50)}"\n` +
        `  Scope: ${documentId ? `Document (${documentId})` : "Global User Documents"}\n` +
        `  Total Chunks Evaluated: ${allChunks.length}\n` +
        `  Top Hybrid Matches: ${topCandidates.length}\n` +
        `  Final Chunks (with Adjacent Expansion): ${finalChunks.length}`
      );

      return finalChunks.map((c) => ({
        id: c.id,
        documentId: c.document_id,
        text: c.text,
        source: c.heading || `Page ${c.page_number ?? 1}`,
        score: topCandidates.find((tc) => tc.chunk.id === c.id)?.finalScore ?? 0.5,
        metadata: {
          pageNumber: c.page_number,
          heading: c.heading,
          sectionPath: c.section_path,
          chunkIndex: c.chunk_index,
        },
      }));
    } catch (e) {
      console.warn("[NASUKI][RAG] Hybrid retrieval error, falling back:", e);
      return [];
    }
  },
};
