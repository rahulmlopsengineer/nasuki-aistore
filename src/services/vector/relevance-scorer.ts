// RelevanceScorer — ranks retrieved memory candidates using similarity,
// importance, recency decay, and conversation relevance.

import { VECTOR_CONFIG } from "@/src/constants/config";
import { Memory } from "@/src/types";
import { VectorSearchResult } from "./types";

export function calculateRecencyScore(isoDate: string): number {
  const now = Date.now();
  const created = new Date(isoDate).getTime();
  const ageHours = Math.max(0, (now - created) / (1000 * 60 * 60));

  // Half-life decay: ~48 hours
  return Math.exp(-ageHours / 48);
}

export const RelevanceScorer = {
  rankCandidates(
    candidates: VectorSearchResult[],
    currentConversationId?: string | null
  ): VectorSearchResult[] {
    const weights = VECTOR_CONFIG.scoringWeights;

    const scored = candidates.map((c) => {
      const mem = c.item;
      const sim = c.similarity; // 0.0 - 1.0
      const imp = Math.min(Math.max(mem.importance, 0.0), 1.0);
      const recency = calculateRecencyScore(mem.createdAt);
      const convoRel =
        currentConversationId && mem.conversationId === currentConversationId
          ? 1.0
          : 0.3;

      const finalScore =
        weights.similarity * sim +
        weights.importance * imp +
        weights.recency * recency +
        weights.conversationRelevance * convoRel;

      return {
        item: mem,
        similarity: sim,
        finalScore,
      };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored;
  },
};
