// Local offline embedding service.
// Generates 64-dimensional normalized vector embeddings on-device using a
// deterministic feature projection engine, allowing 100% offline operation
// without cloud APIs or heavy RAM overhead.

import { VECTOR_CONFIG } from "@/src/constants/config";
import { EmbeddingService } from "./types";

const DIMENSION = VECTOR_CONFIG.embeddingDimension; // 64

function fnv32a(str: string, seed: number = 0x811c9dc5): number {
  let hval = seed;
  for (let i = 0; i < str.length; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  if (norm === 0) return vec;
  const mag = Math.sqrt(norm);
  return vec.map((v) => v / mag);
}

export class LocalEmbeddingEngine implements EmbeddingService {
  private loaded: boolean = true;

  getDimension(): number {
    return DIMENSION;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async unload(): Promise<void> {
    this.loaded = false;
    console.log("[NASUKI][VECTOR] Local embedding engine unloaded.");
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.loaded = true;
    if (!text || !text.trim()) {
      return new Array(DIMENSION).fill(0);
    }

    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ").trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    const vector = new Array(DIMENSION).fill(0);

    for (const word of words) {
      const h = fnv32a(word);
      const index = h % DIMENSION;
      const sign = ((h >> 16) & 1) === 0 ? 1 : -1;
      vector[index] += sign * 1.5;

      // Character n-grams for subword similarity
      if (word.length >= 3) {
        for (let i = 0; i < word.length - 2; i++) {
          const ngram = word.substring(i, i + 3);
          const nh = fnv32a(ngram);
          const nIndex = nh % DIMENSION;
          const nSign = ((nh >> 16) & 1) === 0 ? 1 : -1;
          vector[nIndex] += nSign * 0.5;
        }
      }
    }

    return normalizeVector(vector);
  }
}

export const localEmbeddingEngine = new LocalEmbeddingEngine();
