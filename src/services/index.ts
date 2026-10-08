// Barrel for services.
export { AuthService } from "./auth-service";
export { ChatService } from "./chat-service";
export { ModelService } from "./model-service";
export { DocumentService } from "./document-service";
export { CreditService } from "./credit-service";
export { FeedbackService, BugReportService } from "./feedback-service";
export { OnboardingService } from "./onboarding-service";
export { DataDeletionService } from "./data-deletion-service";
export { LocalInference, DEFAULT_MODEL_ID, SUPPORTED_MODELS, getModelPath, ContextBuilder, PromptFormatter, ConversationSummarizer, estimateTokens } from "./local-inference";
export { ContextEngine, MemoryExtractor, MemoryConsolidator, QueryAnalyzer, VectorBenchmark, defaultVectorStore } from "./vector";
export * from "./vector/types";
export { DocumentContextRetriever, HybridDocumentRetriever, DocumentChunker, DocumentEmbedder, RagDebug } from "./rag";
export type { ContextRetriever, ContextChunk } from "./rag";
export {
  getActiveUserId,
  setActiveUserId,
  requireActiveUserId,
} from "./active-user";
