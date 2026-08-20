// DocumentService — mock RAG documents. Phase 4 wires PDF parsing + embeddings.

import { mockDocuments } from "@/src/constants/mock-data";
import { DocumentFile } from "@/src/types";
import { delay, nowIso, uid } from "@/src/utils/misc";

let docs: DocumentFile[] = [...mockDocuments];

export const DocumentService = {
  async listDocuments(): Promise<DocumentFile[]> {
    await delay(400);
    return [...docs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getDocument(id: string): Promise<DocumentFile | undefined> {
    await delay(200);
    return docs.find((d) => d.id === id);
  },

  // Mock upload -> processing -> ready, reporting each status transition.
  async upload(
    name: string,
    onStatus?: (doc: DocumentFile) => void,
  ): Promise<DocumentFile> {
    const doc: DocumentFile = {
      id: uid("doc"),
      name,
      type: "pdf",
      sizeKb: 320 + Math.round(Math.random() * 900),
      status: "uploading",
      chunkCount: 0,
      createdAt: nowIso(),
    };
    docs = [doc, ...docs];
    onStatus?.(doc);
    await delay(700);
    const processing = { ...doc, status: "processing" as const };
    docs = docs.map((d) => (d.id === doc.id ? processing : d));
    onStatus?.(processing);
    await delay(1400);
    const ready = {
      ...doc,
      status: "ready" as const,
      chunkCount: 18 + Math.round(Math.random() * 40),
    };
    docs = docs.map((d) => (d.id === doc.id ? ready : d));
    onStatus?.(ready);
    return ready;
  },

  async remove(id: string): Promise<void> {
    await delay(150);
    docs = docs.filter((d) => d.id !== id);
  },
};
