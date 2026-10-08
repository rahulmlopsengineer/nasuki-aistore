// Types and interfaces for NASUKI Adaptive Local Vector Context Engine.

import { Memory, MemoryType, Message } from "@/src/types";

export interface VectorItem {
  id: string;
  userId: string;
  conversationId?: string | null;
  content: string;
  memoryType: MemoryType;
  importance: number;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface VectorSearchResult {
  item: Memory;
  similarity: number;
  finalScore: number;
}

export interface VectorSearchOptions {
  userId: string;
  conversationId?: string | null;
  memoryType?: MemoryType;
  topK?: number;
  minSimilarity?: number;
}

export interface VectorCountOptions {
  userId: string;
  conversationId?: string | null;
}

export interface VectorStore {
  insert(item: Memory): Promise<void>;
  search(queryEmbedding: number[], options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  update(id: string, patch: Partial<Memory>): Promise<void>;
  count(options: VectorCountOptions): Promise<number>;
  clear(userId: string): Promise<void>;
}

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  getDimension(): number;
  isLoaded(): boolean;
  unload(): Promise<void>;
}

export interface AdaptiveContextBudget {
  ramState: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  totalContextLimitTokens: number;
  reservedOutputTokens: number;
  inputBudgetTokens: number;
  workingMemoryTurns: number;
  maxRetrievedMemories: number;
}

export interface RetrievalDecision {
  shouldRetrieve: boolean;
  reason: string;
  searchQuery?: string;
}

export interface AdaptiveContextResult {
  prompt: string;
  systemPrompt: string;
  workingMemory: Message[];
  retrievedMemories: Memory[];
  retrievedDocuments: string[];
  currentUserMessage: string;
  estimatedTokens: number;
  budget: AdaptiveContextBudget;
  retrievalDecision: RetrievalDecision;
  truncated: boolean;
}
