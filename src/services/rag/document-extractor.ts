// DocumentExtractor — text extraction for local PDF, TXT, Markdown, and DOCX files.

import { ParsedDocumentSection } from "./document-chunker";

export const DocumentExtractor = {
  async extractSections(
    fileContent: string,
    fileType: "pdf" | "txt" | "md" | "docx",
    filename: string
  ): Promise<ParsedDocumentSection[]> {
    const raw = fileContent.trim();
    if (!raw) {
      return [{ text: `Empty document: ${filename}`, pageNumber: 1, heading: filename }];
    }

    if (fileType === "md") {
      return this.extractMarkdown(raw, filename);
    } else if (fileType === "pdf") {
      return this.extractPdf(raw, filename);
    } else if (fileType === "docx") {
      return this.extractDocx(raw, filename);
    } else {
      // Plain text
      return [{ text: raw, pageNumber: 1, heading: filename, sectionPath: filename }];
    }
  },

  extractMarkdown(raw: string, filename: string): ParsedDocumentSection[] {
    const lines = raw.split("\n");
    const sections: ParsedDocumentSection[] = [];
    let currentHeading = filename;
    let currentBuffer: string[] = [];

    for (const line of lines) {
      if (/^#{1,3}\s+/.test(line)) {
        if (currentBuffer.length > 0) {
          sections.push({
            text: currentBuffer.join("\n"),
            pageNumber: 1,
            heading: currentHeading,
            sectionPath: `${filename} > ${currentHeading}`,
          });
          currentBuffer = [];
        }
        currentHeading = line.replace(/^#{1,3}\s+/, "").trim();
      } else {
        currentBuffer.push(line);
      }
    }

    if (currentBuffer.length > 0) {
      sections.push({
        text: currentBuffer.join("\n"),
        pageNumber: 1,
        heading: currentHeading,
        sectionPath: `${filename} > ${currentHeading}`,
      });
    }

    return sections.length > 0 ? sections : [{ text: raw, pageNumber: 1, heading: filename }];
  },

  extractPdf(raw: string, filename: string): ParsedDocumentSection[] {
    const pages = raw.split(/(?:--- Page \d+ ---|\f)/i);
    const sections: ParsedDocumentSection[] = [];

    pages.forEach((pageText, idx) => {
      const clean = pageText.trim();
      if (clean) {
        sections.push({
          text: clean,
          pageNumber: idx + 1,
          heading: `Page ${idx + 1}`,
          sectionPath: `${filename} > Page ${idx + 1}`,
        });
      }
    });

    return sections.length > 0 ? sections : [{ text: raw, pageNumber: 1, heading: filename }];
  },

  extractDocx(raw: string, filename: string): ParsedDocumentSection[] {
    const paragraphs = raw.split(/\n\s*\n/);
    return paragraphs.map((p, idx) => ({
      text: p.trim(),
      pageNumber: Math.floor(idx / 3) + 1,
      heading: `Section ${idx + 1}`,
      sectionPath: `${filename} > Section ${idx + 1}`,
    }));
  },
};
