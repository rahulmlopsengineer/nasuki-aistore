// ContextRetriever — abstraction for grounding generation in local documents, files, or notes.
// Connects hybrid vector + keyword semantic search to the central ContextEngine.

import { HybridDocumentRetriever } from "./hybrid-retriever";

export interface ContextChunk {
  id: string;
  documentId?: string;
  text: string;
  source: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface RetrievalOptions {
  userId?: string;
  documentId?: string | null;
  limit?: number;
  minScore?: number;
}

export interface ContextRetriever {
  retrieve(query: string, options?: RetrievalOptions): Promise<ContextChunk[]>;
}

export const DocumentContextRetriever: ContextRetriever = {
  async retrieve(query: string, options?: RetrievalOptions): Promise<ContextChunk[]> {
    if (!query || !query.trim()) return [];
    try {
      return await HybridDocumentRetriever.retrieveHybrid(query, options);
    } catch (e) {
      console.warn("[NASUKI][RAG] Hybrid document retrieval error fallback:", e);
      return [];
    }
  },
};
