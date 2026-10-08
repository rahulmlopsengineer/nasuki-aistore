// QueryAnalyzer — evaluates whether a user prompt requires semantic memory retrieval.
// Prevents unnecessary vector searches for trivia, simple math, or code requests,
// while triggering retrieval for requests referencing project context, decisions,
// user preferences, or historical information.

import { RetrievalDecision } from "./types";

const RETRIEVAL_TRIGGERS = [
  /what (did|have|was) i (decide|say|choose|pick|mention|use|write|set)/i,
  /remember|recall|previous|earlier|yesterday|last time/i,
  /our (project|app|architecture|plan|goal|strategy|decision)/i,
  /continue (the|our)|as (we|i) discussed/i,
  /my (preference|preference|setting|rule|constraint)/i,
  /nasuki/i,
  /model|gemma|llama|sqlite|gguf/i,
];

const TRIVIA_OR_SIMPLE = [
  /^(hi|hello|hey|greetings|thanks|thank you|ok|okay|bye)\b/i,
  /^what is (\d+\s*[\+\-\*\/]\s*\d+|a \w+|the meaning of life)/i,
  /^(write|create|code|generate) (a|an)?\s*(function|script|python|js|loop|css|html)/i,
];

export const QueryAnalyzer = {
  analyzeQuery(query: string, workingMemoryTurnCount: number): RetrievalDecision {
    const cleaned = query.trim();

    // Check trivia / simple command override
    for (const pattern of TRIVIA_OR_SIMPLE) {
      if (pattern.test(cleaned) && !/nasuki|project|decide|discussed/i.test(cleaned)) {
        return {
          shouldRetrieve: false,
          reason: "Prompt identified as simple trivia, greeting, or code generator request.",
        };
      }
    }

    // Check explicit retrieval triggers
    for (const pattern of RETRIEVAL_TRIGGERS) {
      if (pattern.test(cleaned)) {
        return {
          shouldRetrieve: true,
          reason: "Prompt matches semantic retrieval pattern.",
          searchQuery: cleaned,
        };
      }
    }

    // Immediate short follow-up check (e.g. "Why?", "Explain more")
    if (cleaned.split(/\s+/).length <= 4 && workingMemoryTurnCount > 0) {
      return {
        shouldRetrieve: false,
        reason: "Short follow-up query covered by recent working memory.",
      };
    }

    // Default: perform light retrieval if prompt is substantial
    return {
      shouldRetrieve: cleaned.split(/\s+/).length > 3,
      reason: "Default heuristic retrieval for query.",
      searchQuery: cleaned,
    };
  },
};
