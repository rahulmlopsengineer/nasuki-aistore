// DocumentChunker — structure-aware document chunking engine.
// Respects semantic boundaries (headings, sections, paragraphs, lists)
// with 10-20% overlap, targeting 150-350 tokens per chunk (~450 max).

import { estimateTokens } from "../local-inference/context-builder";

export interface ParsedDocumentSection {
  text: string;
  pageNumber?: number | null;
  heading?: string | null;
  sectionPath?: string | null;
}

export interface ChunkResult {
  chunkIndex: number;
  text: string;
  pageNumber?: number | null;
  heading?: string | null;
  sectionPath?: string | null;
  tokenCount: number;
}

export interface ChunkerOptions {
  targetTokens?: number; // default 250
  maxTokens?: number; // default 450
  overlapPercent?: number; // default 0.15 (15%)
}

export const DocumentChunker = {
  chunkDocument(
    sections: ParsedDocumentSection[],
    options?: ChunkerOptions
  ): ChunkResult[] {
    const targetTokens = options?.targetTokens ?? 250;
    const maxTokens = options?.maxTokens ?? 450;
    const overlapRatio = options?.overlapPercent ?? 0.15;

    const results: ChunkResult[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const paragraphs = section.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      let currentText = "";
      let currentTokens = 0;

      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const paraTokens = estimateTokens(para);

        if (currentTokens + paraTokens <= maxTokens) {
          currentText = currentText ? `${currentText}\n\n${para}` : para;
          currentTokens += paraTokens;

          if (currentTokens >= targetTokens) {
            results.push({
              chunkIndex: chunkIndex++,
              text: currentText,
              pageNumber: section.pageNumber,
              heading: section.heading,
              sectionPath: section.sectionPath,
              tokenCount: currentTokens,
            });

            // Calculate 15% overlap from end of currentText for next chunk
            const words = currentText.split(/\s+/);
            const overlapWords = Math.ceil(words.length * overlapRatio);
            currentText = words.slice(-overlapWords).join(" ");
            currentTokens = estimateTokens(currentText);
          }
        } else {
          // Push active chunk before starting new paragraph
          if (currentText.trim()) {
            results.push({
              chunkIndex: chunkIndex++,
              text: currentText,
              pageNumber: section.pageNumber,
              heading: section.heading,
              sectionPath: section.sectionPath,
              tokenCount: currentTokens,
            });
          }

          currentText = para;
          currentTokens = paraTokens;
        }
      }

      if (currentText.trim()) {
        results.push({
          chunkIndex: chunkIndex++,
          text: currentText,
          pageNumber: section.pageNumber,
          heading: section.heading,
          sectionPath: section.sectionPath,
          tokenCount: currentTokens,
        });
      }
    }

    return results;
  },
};
