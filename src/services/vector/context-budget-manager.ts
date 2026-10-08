// Resource-aware context budget manager.
// Queries DeviceDiagnostics to adapt token budgets, working memory limits,
// and retrieval sizes dynamically according to real-time available RAM.

import * as DeviceDiagnostics from "../DeviceDiagnostics";
import { AdaptiveContextBudget } from "./types";

export const ContextBudgetManager = {
  async getAdaptiveBudget(): Promise<AdaptiveContextBudget> {
    let availableRAM = 800; // default safe fallback
    try {
      const status = await DeviceDiagnostics.getHardwareStatus();
      availableRAM = status.availableRamMB;
    } catch {
      // Fallback for non-Android environments or diagnostics unavailable
    }

    if (availableRAM < 400) {
      // CRITICAL / HIGH PRESSURE (<400MB RAM)
      return {
        ramState: "CRITICAL",
        totalContextLimitTokens: 128,
        reservedOutputTokens: 48,
        inputBudgetTokens: 80,
        workingMemoryTurns: 3,
        maxRetrievedMemories: 2,
      };
    } else if (availableRAM < 700) {
      // LOW RAM / CAUTION (400-699MB RAM)
      return {
        ramState: "LOW",
        totalContextLimitTokens: 200,
        reservedOutputTokens: 64,
        inputBudgetTokens: 136,
        workingMemoryTurns: 4,
        maxRetrievedMemories: 3,
      };
    } else if (availableRAM < 1200) {
      // MEDIUM / NORMAL RAM (700-1199MB RAM)
      return {
        ramState: "MEDIUM",
        totalContextLimitTokens: 380,
        reservedOutputTokens: 96,
        inputBudgetTokens: 284,
        workingMemoryTurns: 6,
        maxRetrievedMemories: 5,
      };
    } else {
      // HIGH RAM (>=1200MB RAM)
      return {
        ramState: "HIGH",
        totalContextLimitTokens: 512,
        reservedOutputTokens: 128,
        inputBudgetTokens: 384,
        workingMemoryTurns: 8,
        maxRetrievedMemories: 6,
      };
    }
  },
};
