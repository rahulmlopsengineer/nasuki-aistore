// MemoryExtractor & Deduplicator — converts meaningful conversation exchanges
// into semantic memories and updates or deduplicates existing memories.

import { VECTOR_CONFIG } from "@/src/constants/config";
import { MemoryRepository } from "@/src/database";
import { Memory, MemoryType } from "@/src/types";
import { localEmbeddingEngine } from "./embedding-service";

const PERSISTENT_PATTERNS: Array<{ regex: RegExp; type: MemoryType; importance: number }> = [
  { regex: /nasuki|app|architecture|framework|build|offline/i, type: "PROJECT", importance: 0.9 },
  { regex: /decided|decide|choose|selected|will use|agreed/i, type: "DECISION", importance: 0.85 },
  { regex: /prefer|like|want|always|never|must/i, type: "PREFERENCE", importance: 0.8 },
  { regex: /goal|target|objective|milestone/i, type: "GOAL", importance: 0.8 },
  { regex: /remember|note that|keep in mind|important/i, type: "INSTRUCTION", importance: 0.85 },
  { regex: /constraint|ram|device|limit|gb/i, type: "CONSTRAINT", importance: 0.85 },
];

export const MemoryExtractor = {
  shouldExtract(userText: string, assistantText: string): boolean {
    const combined = `${userText} ${assistantText}`;
    if (combined.length < 15) return false;

    for (const p of PERSISTENT_PATTERNS) {
      if (p.regex.test(combined)) return true;
    }
    return false;
  },

  async extractAndStoreMemory(
    userId: string,
    conversationId: string | null,
    userText: string,
    assistantText: string,
    sourceMessageId?: string | null
  ): Promise<Memory | null> {
    if (!this.shouldExtract(userText, assistantText)) return null;

    let memType: MemoryType = "FACT";
    let importance = 0.7;

    const combined = `${userText} ${assistantText}`;
    for (const p of PERSISTENT_PATTERNS) {
      if (p.regex.test(combined)) {
        memType = p.type;
        importance = p.importance;
        break;
      }
    }

    // Clean memory content
    const memoryContent = `User requested: "${userText.slice(0, 150)}". Key outcome: ${assistantText.slice(0, 180)}`;
    const embedding = await localEmbeddingEngine.generateEmbedding(memoryContent);

    // Deduplication check
    const existingMemories = await MemoryRepository.getMemoriesForUser(userId, { limit: 50 });
    const { cosineSimilarity } = await import("./vector-store");

    for (const existing of existingMemories) {
      if (existing.embedding && existing.embedding.length > 0) {
        const sim = cosineSimilarity(embedding, existing.embedding);
        if (sim >= VECTOR_CONFIG.deduplicationSimilarityThreshold) {
          console.log(`[NASUKI][VECTOR] Merging near-duplicate memory (${(sim * 100).toFixed(1)}% match): "${existing.content.slice(0, 50)}…"`);
          await MemoryRepository.updateMemory(existing.id, {
            content: memoryContent,
            importance: Math.max(existing.importance, importance),
            accessCount: existing.accessCount + 1,
            embedding,
          });
          return existing;
        }
      }
    }

    // Create new memory
    const memory = await MemoryRepository.createMemory({
      userId,
      conversationId,
      content: memoryContent,
      memoryType: memType,
      importance,
      sourceMessageId,
      tokenCount: Math.ceil(memoryContent.length / 3.8),
      embeddingStatus: "ready",
      embedding,
    });

    console.log(`[NASUKI][VECTOR] Extracted new ${memType} memory for user ${userId}: "${memoryContent.slice(0, 60)}…"`);
    return memory;
  },
};
