// MemoryConsolidator — background/idle memory consolidation system.
// Clusters related memories, merges duplicate entries, and maintains a durable,
// compact memory index without blocking the active chat thread.

import { VECTOR_CONFIG } from "@/src/constants/config";
import { MemoryRepository } from "@/src/database";

export const MemoryConsolidator = {
  async consolidateMemories(userId: string): Promise<{ mergedCount: number }> {
    try {
      const memories = await MemoryRepository.getMemoriesForUser(userId, { limit: 200 });
      if (memories.length < 5) return { mergedCount: 0 };

      const { cosineSimilarity } = await import("./vector-store");
      let mergedCount = 0;
      const processed = new Set<string>();

      for (let i = 0; i < memories.length; i++) {
        const primary = memories[i];
        if (processed.has(primary.id) || !primary.embedding) continue;

        for (let j = i + 1; j < memories.length; j++) {
          const candidate = memories[j];
          if (processed.has(candidate.id) || !candidate.embedding) continue;

          const sim = cosineSimilarity(primary.embedding, candidate.embedding);
          if (sim >= VECTOR_CONFIG.deduplicationSimilarityThreshold) {
            console.log(`[NASUKI][CONSOLIDATION] Merging memory ${candidate.id} into ${primary.id} (similarity: ${(sim * 100).toFixed(1)}%)`);

            const combinedContent = primary.content.length >= candidate.content.length
              ? primary.content
              : candidate.content;

            await MemoryRepository.updateMemory(primary.id, {
              content: combinedContent,
              importance: Math.max(primary.importance, candidate.importance),
              accessCount: primary.accessCount + candidate.accessCount,
            });

            await MemoryRepository.deleteMemory(candidate.id);
            processed.add(candidate.id);
            mergedCount++;
          }
        }
      }

      if (mergedCount > 0) {
        console.log(`[NASUKI][CONSOLIDATION] Completed background memory consolidation for user ${userId}. Merged ${mergedCount} redundant memories.`);
      }

      return { mergedCount };
    } catch (e) {
      console.error("[NASUKI][CONSOLIDATION] Memory consolidation error:", e);
      return { mergedCount: 0 };
    }
  },
};
