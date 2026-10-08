// SQLite-backed VectorStore with local cosine similarity and user isolation.

import { MemoryRepository } from "@/src/database";
import { Memory } from "@/src/types";
import {
  VectorCountOptions,
  VectorSearchOptions,
  VectorSearchResult,
  VectorStore,
} from "./types";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SQLiteVectorStore implements VectorStore {
  async insert(item: Memory): Promise<void> {
    await MemoryRepository.createMemory({
      userId: item.userId,
      conversationId: item.conversationId,
      content: item.content,
      memoryType: item.memoryType,
      importance: item.importance,
      sourceMessageId: item.sourceMessageId,
      tokenCount: item.tokenCount,
      embeddingStatus: item.embedding ? "ready" : "pending",
      embedding: item.embedding,
    });
  }

  async search(
    queryEmbedding: number[],
    options: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (!queryEmbedding || queryEmbedding.length === 0) return [];

    const memories = await MemoryRepository.getMemoriesForUser(options.userId, {
      conversationId: options.conversationId,
      memoryType: options.memoryType,
      limit: 100,
    });

    const results: VectorSearchResult[] = [];
    const minSim = options.minSimilarity ?? 0.2;

    for (const mem of memories) {
      if (!mem.embedding || mem.embedding.length === 0) continue;
      const similarity = cosineSimilarity(queryEmbedding, mem.embedding);
      if (similarity >= minSim) {
        results.push({
          item: mem,
          similarity,
          finalScore: similarity, // Will be re-ranked by RelevanceScorer
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topK = options.topK ?? 10;
    return results.slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    await MemoryRepository.deleteMemory(id);
  }

  async update(id: string, patch: Partial<Memory>): Promise<void> {
    await MemoryRepository.updateMemory(id, patch);
  }

  async count(options: VectorCountOptions): Promise<number> {
    const memories = await MemoryRepository.getMemoriesForUser(options.userId, {
      conversationId: options.conversationId,
    });
    return memories.length;
  }

  async clear(userId: string): Promise<void> {
    await MemoryRepository.deleteAllForUser(userId);
  }
}

export const defaultVectorStore = new SQLiteVectorStore();
