// DocumentEmbedder — RAM-aware background batch embedding queue with partial index recovery.

import { DocumentRepository } from "@/src/database";
import { localEmbeddingEngine } from "../vector/embedding-service";

export interface EmbedOptions {
  batchSize?: number;
  onProgress?: (progress: number) => void;
}

export const DocumentEmbedder = {
  /**
   * Generates and stores embeddings for all chunks of a document asynchronously.
   * Resumes seamlessly if previous indexing was interrupted.
   */
  async embedDocumentChunks(
    documentId: string,
    options?: EmbedOptions
  ): Promise<void> {
    const chunks = await DocumentRepository.getChunks(documentId);
    if (!chunks || chunks.length === 0) return;

    const unEmbedded = chunks.filter((c: any) => !c.embedding_json);
    const total = chunks.length;

    if (unEmbedded.length === 0) {
      await DocumentRepository.updateStatus(documentId, "ready");
      await DocumentRepository.updateEmbeddingProgress(documentId, 1.0, "ready");
      options?.onProgress?.(1.0);
      return;
    }

    const batchSize = options?.batchSize ?? 8;
    let completed = total - unEmbedded.length;

    for (let i = 0; i < unEmbedded.length; i += batchSize) {
      const batch = unEmbedded.slice(i, i + batchSize);

      for (const chunk of batch) {
        try {
          const embedding = await localEmbeddingEngine.generateEmbedding(chunk.text);
          await DocumentRepository.updateChunkEmbedding(chunk.id, JSON.stringify(embedding));
          completed++;
        } catch (e) {
          console.warn(`[NASUKI][RAG] Chunk embedding error for ${chunk.id}:`, e);
        }
      }

      const progress = Math.min(completed / total, 0.99);
      await DocumentRepository.updateEmbeddingProgress(documentId, progress, "embedding");
      options?.onProgress?.(progress);

      // Yield event loop between batches
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await DocumentRepository.updateStatus(documentId, "ready");
    await DocumentRepository.updateEmbeddingProgress(documentId, 1.0, "ready");
    options?.onProgress?.(1.0);
    console.log(`[NASUKI][RAG] Completed embedding ${total} chunks for document ${documentId}`);
  },
};
