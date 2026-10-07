// Centralized prompt formatter — single source of truth for prompt formatting.
// Ensures prompts adhere strictly to the target GGUF model layout.

export interface FormatPromptInput {
  systemPrompt?: string;
  summary?: string | null;
  history?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  retrievedContext?: string | null;
  currentUserMessage: string;
}

export const PromptFormatter = {
  format(input: FormatPromptInput): string {
    const sys = input.systemPrompt ?? "You are NASUKI, a private offline AI assistant.";
    const parts: string[] = [`System: ${sys}`];

    if (input.summary && input.summary.trim()) {
      parts.push(`Summary of conversation so far:\n${input.summary.trim()}`);
    }

    if (input.retrievedContext && input.retrievedContext.trim()) {
      parts.push(`Relevant document context:\n${input.retrievedContext.trim()}`);
    }

    if (input.history && input.history.length > 0) {
      const historyLines = input.history.map((m) => {
        const label = m.role === "user" ? "User" : "Assistant";
        return `${label}: ${m.content}`;
      });
      parts.push(historyLines.join("\n"));
    }

    parts.push(`User: ${input.currentUserMessage}\nAssistant:`);
    return parts.join("\n\n");
  },
};
