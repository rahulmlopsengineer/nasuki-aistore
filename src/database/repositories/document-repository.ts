// Document + chunk metadata (RAG preparation only). No PDF extraction,
// embeddings, or vector search in Phase 2.

import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { DbDocumentStatus } from "../types";

export interface CreateDocumentInput {
  userId: string;
  filename: string;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  status?: DbDocumentStatus;
}

export interface AddChunkInput {
  documentId: string;
  pageNumber?: number | null;
  chunkIndex: number;
  text: string;
  embeddingReference?: string | null;
}

export const DocumentRepository = {
  async createDocument(input: CreateDocumentInput): Promise<string> {
    const db = getExecutor();
    const now = nowIso();
    const id = uid("doc");
    await db.runAsync(
      `INSERT INTO documents
        (id, user_id, filename, file_path, mime_type, file_size, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, input.userId, input.filename, input.filePath ?? null, input.mimeType ?? null,
        input.fileSize ?? null, input.status ?? "pending", now, now,
      ],
    );
    return id;
  },

  async listDocuments(userId: string) {
    return getExecutor().getAllAsync(
      "SELECT * FROM documents WHERE user_id = ? ORDER BY datetime(created_at) DESC",
      [userId],
    );
  },

  async getDocument(id: string) {
    return getExecutor().getFirstAsync("SELECT * FROM documents WHERE id = ?", [id]);
  },

  async updateStatus(id: string, status: DbDocumentStatus): Promise<void> {
    await getExecutor().runAsync(
      "UPDATE documents SET status = ?, updated_at = ? WHERE id = ?",
      [status, nowIso(), id],
    );
  },

  async addChunk(input: AddChunkInput): Promise<string> {
    const id = uid("chk");
    await getExecutor().runAsync(
      `INSERT INTO document_chunks
        (id, document_id, page_number, chunk_index, text, embedding_reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, input.documentId, input.pageNumber ?? null, input.chunkIndex, input.text,
        input.embeddingReference ?? null, nowIso(),
      ],
    );
    return id;
  },

  async getChunks(documentId: string) {
    return getExecutor().getAllAsync(
      "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC",
      [documentId],
    );
  },

  async deleteDocument(id: string): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM document_chunks WHERE document_id = ?", [id]);
      await db.runAsync("DELETE FROM documents WHERE id = ?", [id]);
    });
  },

  async deleteAllForUser(userId: string): Promise<void> {
    const db = getExecutor();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM document_chunks WHERE document_id IN
          (SELECT id FROM documents WHERE user_id = ?)`,
        [userId],
      );
      await db.runAsync("DELETE FROM documents WHERE user_id = ?", [userId]);
    });
  },
};
