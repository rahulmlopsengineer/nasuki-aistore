// ContextRetriever — abstraction for grounding generation in documents, files, or notes.
// Isolates retrieval sources from the core chat and inference layers.

export interface ContextChunk {
  id: string;
  documentId?: string;
  text: string;
  source: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface RetrievalOptions {
  limit?: number;
  minScore?: number;
}

export interface ContextRetriever {
  retrieve(query: string, options?: RetrievalOptions): Promise<ContextChunk[]>;
}

/**
 * Basic document retriever querying SQLite document_chunks table.
 */
export const DocumentContextRetriever: ContextRetriever = {
  async retrieve(query: string, options?: RetrievalOptions): Promise<ContextChunk[]> {
    if (!query || !query.trim()) return [];
    try {
      const { getExecutor } = await import("@/src/database/client");
      const db = getExecutor();
      const limit = options?.limit ?? 3;
      const term = `%${query.trim()}%`;

      const rows = await db.getAllAsync<{ id: string; document_id: string; text: string }>(
        `SELECT id, document_id, text FROM document_chunks
         WHERE text LIKE ?
         LIMIT ?`,
        [term, limit]
      );

      return (rows ?? []).map((r) => ({
        id: r.id,
        documentId: r.document_id,
        text: r.text,
        source: "document_chunk",
      }));
    } catch (e) {
      console.warn("[NASUKI][RAG] Document retrieval fallback:", e);
      return [];
    }
  },
};
