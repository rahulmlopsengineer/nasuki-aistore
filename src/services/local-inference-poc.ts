// Wraps llama.rn (llama.cpp) directly with zero external dependencies.
// Does NOT touch ChatService, ModelManager, or production database.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export type POCModelStatus =
  | "UNLOADED"
  | "LOADING"
  | "READY"
  | "GENERATING"
  | "ERROR";

export type POCErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_LOAD_FAILED"
  | "NATIVE_RUNTIME_ERROR"
  | "GENERATION_ERROR"
  | "OUT_OF_MEMORY"
  | "UNSUPPORTED_PLATFORM";

export interface POCMetrics {
  loadTimeMs?: number;
  generationTimeMs?: number;
  firstTokenTimeMs?: number;
  tokenCount?: number;
  tokensPerSec?: number;
  contextSize?: number;
  promptTokens?: number;
}

export interface POCGenerationResult {
  text: string;
  metrics: POCMetrics;
  error?: string;
  errorCode?: POCErrorCode;
}

export const DEFAULT_MODEL_FILENAME = "gemma-2-2b-it-Q4_K_M.gguf";

export const getModelDirectory = (): string => {
  if (!FileSystem.documentDirectory) return "";
  return `${FileSystem.documentDirectory}models/`;
};

export const getDefaultModelPath = (): string => {
  return `${getModelDirectory()}${DEFAULT_MODEL_FILENAME}`;
};

let activeContext: any = null;
let currentStatus: POCModelStatus = "UNLOADED";

export const LocalInferencePOC = {
  getStatus(): POCModelStatus {
    return currentStatus;
  },

  /**
   * Checks if the GGUF model file exists at the specified or default path.
   */
  async checkModelFile(targetPath?: string): Promise<{
    exists: boolean;
    path: string;
    sizeBytes?: number;
  }> {
    const filePath = targetPath || getDefaultModelPath();
    if (Platform.OS === "web") {
      return { exists: false, path: filePath };
    }
    try {
      // Ensure models directory exists
      const dir = getModelDirectory();
      if (dir) {
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
      }
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return {
        exists: fileInfo.exists,
        path: filePath,
        sizeBytes: fileInfo.exists && !fileInfo.isDirectory ? fileInfo.size : undefined,
      };
    } catch {
      return { exists: false, path: filePath };
    }
  },

  /**
   * Loads the Gemma GGUF model into memory via llama.rn.
   */
  async loadModel(
    modelPath?: string,
    onProgress?: (progress: number) => void,
  ): Promise<{ success: boolean; error?: string; errorCode?: POCErrorCode; loadTimeMs?: number }> {
    if (Platform.OS === "web") {
      currentStatus = "ERROR";
      return {
        success: false,
        error: "Local Gemma inference is only supported on native Android/iOS development builds.",
        errorCode: "UNSUPPORTED_PLATFORM",
      };
    }
    const path = modelPath || getDefaultModelPath();
    const fileCheck = await this.checkModelFile(path);
    if (!fileCheck.exists) {
      currentStatus = "ERROR";
      return {
        success: false,
        error: `Model file not found at:\n${path}\n\nPlease push the GGUF file to device storage.`,
        errorCode: "MODEL_NOT_FOUND",
      };
    }
    try {
      // If a context was already loaded, release it first
      if (activeContext) {
        await this.releaseModel();
      }
      currentStatus = "LOADING";
      const startTime = Date.now();
      // Dynamic import to avoid bundling errors on web/unit test environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initLlama } = require("llama.rn");
      // Normalize file path for native llama.cpp (strip file:// if needed or pass full URI)
      const cleanPath = path.startsWith("file://") ? path : `file://${path}`;
      activeContext = await initLlama(
        {
          model: cleanPath,
          n_ctx: 1024, // Conservative context length for initial test
          n_threads: 4, // 4 CPU threads (optimized for big cores)
          n_gpu_layers: 0, // 0 for CPU NEON stability
          use_mlock: true,
          use_mmap: true,
        },
        (progress: number) => {
          onProgress?.(progress);
        },
      );
      const loadTimeMs = Date.now() - startTime;
      currentStatus = "READY";
      return { success: true, loadTimeMs };
    } catch (err: any) {
      currentStatus = "ERROR";
      const message = err?.message || String(err);
      const isOOM = /memory|oom/i.test(message);
      return {
        success: false,
        error: `Failed to load model: ${message}`,
        errorCode: isOOM ? "OUT_OF_MEMORY" : "MODEL_LOAD_FAILED",
      };
    }
  },

  /**
   * Runs a single real inference request against the loaded model.
   */
  async generate(
    prompt: string,
    onToken?: (token: string) => void,
  ): Promise<POCGenerationResult> {
    if (!activeContext) {
      return {
        text: "",
        metrics: {},
        error: "Model is not loaded. Please load the model before generating.",
        errorCode: "MODEL_LOAD_FAILED",
      };
    }
    currentStatus = "GENERATING";
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;
    let accumulatedText = "";
    try {
      // Format prompt into Gemma 2 instruction template
      const formattedPrompt = `<start_of_turn>user\n${prompt.trim()}<end_of_turn>\n<start_of_turn>model\n`;
      const result = await activeContext.completion(
        {
          prompt: formattedPrompt,
          n_predict: 128,
          temperature: 0.7,
          top_p: 0.9,
          stop: ["<end_of_turn>", "<eos>", "<start_of_turn>"],
        },
        (data: { token: string }) => {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now() - startTime;
          }
          tokenCount++;
          accumulatedText += data.token;
          onToken?.(data.token);
        },
      );
      const totalTimeMs = Date.now() - startTime;
      const finalText = (result?.text || accumulatedText).trim();
      const actualTokens = result?.timings?.predicted_n || tokenCount;
      const tokensPerSec =
        result?.timings?.predicted_per_second ||
        (actualTokens > 0 && totalTimeMs > 0 ? (actualTokens / (totalTimeMs / 1000)) : 0);
      currentStatus = "READY";
      return {
        text: finalText,
        metrics: {
          generationTimeMs: totalTimeMs,
          firstTokenTimeMs: firstTokenTime || undefined,
          tokenCount: actualTokens,
          tokensPerSec: Number(tokensPerSec.toFixed(2)),
          contextSize: 1024,
          promptTokens: result?.timings?.prompt_n,
        },
      };
    } catch (err: any) {
      currentStatus = "ERROR";
      const message = err?.message || String(err);
      return {
        text: accumulatedText,
        metrics: {
          generationTimeMs: Date.now() - startTime,
          tokenCount,
        },
        error: `Inference failed: ${message}`,
        errorCode: "GENERATION_ERROR",
      };
    }
  },

  /**
   * Stops active generation.
   */
  async stopGeneration(): Promise<void> {
    if (activeContext) {
      try {
        await activeContext.stopCompletion();
      } catch {
        // Ignore stop errors
      }
    }
    if (currentStatus === "GENERATING") {
      currentStatus = "READY";
    }
  },

  /**
   * Releases and frees the native llama.cpp model context and RAM.
   */
  async releaseModel(): Promise<void> {
    if (activeContext) {
      try {
        await activeContext.release();
      } catch {
        // Ignore release errors
      } finally {
        activeContext = null;
      }
    }
    currentStatus = "UNLOADED";
  },
};