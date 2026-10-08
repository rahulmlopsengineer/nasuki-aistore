// Document + chunk metadata persistence with full embedding vector support.

import { nowIso, uid } from "@/src/utils/misc";
import { getExecutor } from "../client";
import { DbDocumentStatus, DocumentChunkRow, DocumentRow } from "../types";

export interface CreateDocumentInput {
  userId: string;
  filename: string;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  status?: DbDocumentStatus;
  checksum?: string | null;
}

export interface AddChunkInput {
  documentId: string;
  pageNumber?: number | null;
  chunkIndex: number;
  text: string;
  heading?: string | null;
  sectionPath?: string | null;
  tokenCount?: number;
  embeddingReference?: string | null;
  embeddingJson?: string | null;
  checksum?: string | null;
}

export const DocumentRepository = {
  async createDocument(input: CreateDocumentInput): Promise<string> {
    const db = getExecutor();
    const now = nowIso();
    const id = uid("doc");
    await db.runAsync(
      `INSERT INTO documents
        (id, user_id, filename, file_path, mime_type, file_size, status, checksum, embedding_progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?)`,
      [
        id,
        input.userId,
        input.filename,
        input.filePath ?? null,
        input.mimeType ?? null,
        input.fileSize ?? null,
        input.status ?? "pending",
        input.checksum ?? null,
        now,
        now,
      ],
    );
    return id;
  },

  async listDocuments(userId: string): Promise<DocumentRow[]> {
    return getExecutor().getAllAsync<DocumentRow>(
      "SELECT * FROM documents WHERE user_id = ? ORDER BY datetime(created_at) DESC",
      [userId],
    );
  },

  async getDocument(id: string): Promise<DocumentRow | null> {
    return getExecutor().getFirstAsync<DocumentRow>("SELECT * FROM documents WHERE id = ?", [id]);
  },

  async findDocumentByChecksum(userId: string, checksum: string): Promise<DocumentRow | null> {
    return getExecutor().getFirstAsync<DocumentRow>(
      "SELECT * FROM documents WHERE user_id = ? AND checksum = ? AND status = 'ready'",
      [userId, checksum],
    );
  },

  async updateStatus(id: string, status: DbDocumentStatus): Promise<void> {
    await getExecutor().runAsync(
      "UPDATE documents SET status = ?, updated_at = ? WHERE id = ?",
      [status, nowIso(), id],
    );
  },

  async updateEmbeddingProgress(id: string, progress: number, status?: DbDocumentStatus): Promise<void> {
    const now = nowIso();
    if (status) {
      await getExecutor().runAsync(
        "UPDATE documents SET embedding_progress = ?, status = ?, updated_at = ? WHERE id = ?",
        [progress, status, now, id],
      );
    } else {
      await getExecutor().runAsync(
        "UPDATE documents SET embedding_progress = ?, updated_at = ? WHERE id = ?",
        [progress, now, id],
      );
    }
  },

  async addChunk(input: AddChunkInput): Promise<string> {
    const id = uid("chk");
    await getExecutor().runAsync(
      `INSERT INTO document_chunks
        (id, document_id, page_number, chunk_index, text, heading, section_path, token_count, embedding_reference, embedding_json, checksum, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.documentId,
        input.pageNumber ?? null,
        input.chunkIndex,
        input.text,
        input.heading ?? null,
        input.sectionPath ?? null,
        input.tokenCount ?? 0,
        input.embeddingReference ?? null,
        input.embeddingJson ?? null,
        input.checksum ?? null,
        nowIso(),
      ],
    );
    return id;
  },

  async updateChunkEmbedding(chunkId: string, embeddingJson: string): Promise<void> {
    await getExecutor().runAsync(
      "UPDATE document_chunks SET embedding_json = ? WHERE id = ?",
      [embeddingJson, chunkId],
    );
  },

  async getChunks(documentId: string): Promise<DocumentChunkRow[]> {
    return getExecutor().getAllAsync<DocumentChunkRow>(
      "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC",
      [documentId],
    );
  },

  async getAllChunksForUser(userId: string, documentId?: string | null): Promise<DocumentChunkRow[]> {
    if (documentId) {
      return getExecutor().getAllAsync<DocumentChunkRow>(
        `SELECT c.* FROM document_chunks c
         JOIN documents d ON c.document_id = d.id
         WHERE d.user_id = ? AND d.id = ? AND d.status = 'ready'
         ORDER BY c.chunk_index ASC`,
        [userId, documentId],
      );
    }

    return getExecutor().getAllAsync<DocumentChunkRow>(
      `SELECT c.* FROM document_chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE d.user_id = ? AND d.status = 'ready'
       ORDER BY d.created_at DESC, c.chunk_index ASC`,
      [userId],
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
