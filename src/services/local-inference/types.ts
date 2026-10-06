export type ModelStatus =
  | "IDLE"
  | "DOWNLOADING"
  | "VERIFYING"
  | "MODEL_AVAILABLE"
  | "LOADING"
  | "WARMING_UP"
  | "READY"
  | "GENERATING"
  | "ABORTING"
  | "UNLOADING"
  | "FAILED"
  | "ERROR";

export type LocalAIErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_PICK_CANCELLED"
  | "MODEL_COPY_FAILED"
  | "MODEL_DOWNLOAD_FAILED"
  | "MODEL_CORRUPTED"
  | "WEBGPU_UNAVAILABLE"
  | "WASM_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE"
  | "MODEL_LOAD_FAILED"
  | "NATIVE_RUNTIME_ERROR"
  | "GENERATION_ERROR"
  | "OUT_OF_MEMORY"
  | "UNSUPPORTED_PLATFORM"
  | "MODEL_ABORTED";

export interface LoadModelOptions {
  modelId: string;
  filename: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
  onProgress?: (progress: number) => void;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  onToken?: (token: string) => void;
}

export interface InferenceMetrics {
  loadTimeMs?: number;
  warmupTimeMs?: number;
  firstTokenLatencyMs?: number;
  generationTimeMs?: number;
  tokenCount?: number;
  tokensPerSec?: number;
}

export interface GenerationResult {
  text: string;
  metrics: InferenceMetrics;
  error?: string;
  errorCode?: LocalAIErrorCode;
}

export interface WebCapabilities {
  webGPU: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  storage: boolean;
  estimatedDeviceMemoryGB?: number;
}

export interface LocalInferenceEngine {
  getStatus(): ModelStatus;
  checkModelAvailable(options: { modelId: string, filename: string }): Promise<{ exists: boolean; sizeBytes?: number }>;
  loadModel(options: LoadModelOptions): Promise<{ success: boolean; error?: string }>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
  generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult>;
  stopGeneration(): Promise<void>;
  getWebCapabilities?(): Promise<WebCapabilities>;
}
