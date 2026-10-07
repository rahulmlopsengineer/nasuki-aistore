import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { initLlama } from "llama.rn";
import * as DeviceDiagnostics from "./DeviceDiagnostics";
import { AdaptiveController } from "./local-inference/adaptive-controller";
import {
  LocalInferenceEngine,
  ModelStatus,
  LoadModelOptions,
  GenerationOptions,
  GenerationResult,
  LocalAIErrorCode,
  InferenceMetrics
} from "./local-inference/types";

// Memory Safety Thresholds from recovery baseline
const MEM_PRESSURE_THRESHOLD = 250;
const MEM_ABORT_THRESHOLD = 180;

function toNativePath(uri: string): string {
  if (!uri) return uri;
  let path = uri.replace(/^file:\/\//, "");
  path = path.replace(/\/data\/user\/0\//, "/data/data/");
  return path;
}

let contextIdCounter = 0;

class AndroidInferenceEngine implements LocalInferenceEngine {
  private activeContext: any = null;
  private status: ModelStatus = "IDLE";
  private llamaInitializationPromise: Promise<{ success: boolean; error?: string }> | null = null;
  private currentOperationInProgress = false;
  private contextId: number | null = null;
  private activeProfile: string | null = null;

  getStatus(): ModelStatus {
    return this.status;
  }

  isModelLoaded(): boolean {
    return this.activeContext !== null && this.status === "READY";
  }

  async checkModelAvailable(options: { modelId: string, filename: string }): Promise<{ exists: boolean; sizeBytes?: number }> {
    try {
      const info = await FileSystem.getInfoAsync(options.filename);
      return {
        exists: info.exists && !info.isDirectory,
        sizeBytes: info.exists && !info.isDirectory ? (info as any).size : undefined,
      };
    } catch (e) {
      return { exists: false };
    }
  }

  private async checkMemorySafety(operation: string): Promise<boolean> {
    const status = await DeviceDiagnostics.getHardwareStatus();
    const avail = status.availableRamMB;

    console.log(`[NASUKI][ANDROID][MEMORY] Gate: Op=${operation}, Available=${avail.toFixed(1)}MB`);

    if (avail < MEM_ABORT_THRESHOLD) {
      console.error(`[NASUKI][ANDROID][MEMORY] ABORT: Insufficient RAM for ${operation}`);
      return false;
    }

    if (avail < MEM_PRESSURE_THRESHOLD) {
      console.warn(`[NASUKI][ANDROID][MEMORY] HIGH PRESSURE: Proceeding with extreme caution for ${operation}`);
    }

    return true;
  }

  private async runWarmup(): Promise<void> {
    if (!this.activeContext) {
      throw new Error("Warmup failed: llama context is not initialized");
    }

    console.log("[NASUKI][ANDROID][LLAMA] Warmup START");
    await this.activeContext.completion(
      {
        prompt: "Hi",
        n_predict: 2,
        temperature: 0,
        top_p: 1,
      },
      () => {}
    );
    console.log("[NASUKI][ANDROID][LLAMA] Warmup COMPLETE");
  }

  async loadModel(options: LoadModelOptions): Promise<{ success: boolean; error?: string }> {
    console.log(`[NASUKI][ANDROID][LLAMA] loadModel request\nExisting status: ${this.status}\nExisting context: ${this.activeContext !== null}\nExisting initialization promise: ${this.llamaInitializationPromise !== null}`);

    if (this.status === "READY" && this.activeContext !== null) {
      console.log("[NASUKI][ANDROID][LLAMA] Reusing existing READY context");
      return { success: true };
    }

    if (this.llamaInitializationPromise) {
      console.log("[NASUKI][ANDROID][LLAMA] Joining existing initialization promise");
      return this.llamaInitializationPromise;
    }

    if (this.status === "WARMING_UP") {
      console.log("[NASUKI][ANDROID][LLAMA] Model is warming up, waiting for initialization promise");
      if (this.llamaInitializationPromise) return this.llamaInitializationPromise;
    }

    this.status = "LOADING";
    this.llamaInitializationPromise = (async () => {
      const attemptedProfiles = new Set<string>();
      let currentProfile;

      try {
        currentProfile = await AdaptiveController.selectProfile();
      } catch (e: any) {
        console.error("[NASUKI][ANDROID][ADAPTIVE] Profile selection failed/aborted:", e);
        this.status = "FAILED";
        this.llamaInitializationPromise = null;
        return { success: false, error: e.message };
      }

      while (true) {
        const modelLoadStartTime = Date.now();
        let modelLoadEndTime: number | null = null;
        let warmupStartTime: number | null = null;
        let warmupEndTime: number | null = null;

        try {
          console.log(`[NASUKI][ANDROID] Initializing llama.rn engine with profile: ${currentProfile.name}...`);

          // Memory Gate
          if (!(await this.checkMemorySafety("MODEL_LOAD"))) {
              throw new Error("Insufficient available RAM to load model.");
          }

          const nativePath = toNativePath(options.filename);
          const fileInfo = await FileSystem.getInfoAsync(options.filename);
          console.log(`[NASUKI][ANDROID][LLAMA] initLlama START\nPath: ${nativePath}\nExists: ${fileInfo.exists}\nSize: ${(fileInfo as any).size ?? 0}`);

          if (!fileInfo.exists) {
              throw new Error(`Model file not found at path: ${nativePath}`);
          }

          const config = {
            model: nativePath,
            n_ctx: currentProfile.context,
            n_threads: currentProfile.threads,
            n_gpu_layers: currentProfile.gpuLayers,
            use_mmap: currentProfile.use_mmap,
            use_mlock: currentProfile.use_mlock,
          };

          this.activeContext = await initLlama(config, (progress: number) => {
            options.onProgress?.(progress / 100);
          });

          if (!this.activeContext) {
              throw new Error("initLlama returned no context");
          }

          contextIdCounter++;
          this.contextId = contextIdCounter;
          this.activeProfile = currentProfile.name;

          console.log(`[NASUKI][ANDROID][LLAMA] initLlama SUCCESS\nContext created: true\nContext ID: ${this.contextId}\nProfile: ${this.activeProfile}\nn_ctx=${currentProfile.context}, n_threads=${currentProfile.threads}, n_gpu_layers=${currentProfile.gpuLayers}`);
          modelLoadEndTime = Date.now();

          // Minimal Warmup
          const postInitStatus = await DeviceDiagnostics.getHardwareStatus();
          if (postInitStatus.availableRamMB < MEM_PRESSURE_THRESHOLD) {
              console.warn("[NASUKI][ANDROID][MEMORY] Skipping warmup due to critical RAM pressure.");
          } else {
              this.status = "WARMING_UP";
              warmupStartTime = Date.now();
              await this.runWarmup();
              warmupEndTime = Date.now();
          }

          this.status = "READY";
          console.log("[NASUKI][ANDROID][LLAMA] Status transition: WARMING_UP -> READY");
          console.log("[NASUKI][ANDROID] Model loaded and ready.");

          if (warmupStartTime && warmupEndTime) {
              console.log(`[NASUKI][ANDROID] Timings: Load=${modelLoadEndTime - modelLoadStartTime}ms, Warmup=${warmupEndTime - warmupStartTime}ms`);
          }

          return { success: true };
        } catch (e: any) {
          console.error(`[NASUKI][ANDROID][LLAMA] Initialization FAILED with profile ${currentProfile.name}\nError:`, e);
          if (this.activeContext) {
            try { await this.activeContext.release(); } catch {}
            this.activeContext = null;
          }

          const nextProfile = AdaptiveController.getNextFallbackProfile(currentProfile.name, attemptedProfiles);
          if (nextProfile) {
            currentProfile = nextProfile;
            console.log(`[NASUKI][ANDROID][LLAMA] Retrying initialization with fallback profile: ${currentProfile.name}`);
            continue;
          }

          this.status = "FAILED";
          this.activeContext = null;
          this.llamaInitializationPromise = null;
          this.contextId = null;
          this.activeProfile = null;
          return { success: false, error: e.message };
        }
      }
    })();

    return this.llamaInitializationPromise;
  }

  async unloadModel(): Promise<void> {
    this.status = "UNLOADING";
    if (this.activeContext) {
      await this.activeContext.release();
      this.activeContext = null;
    }
    this.status = "IDLE";
    this.llamaInitializationPromise = null;
    this.contextId = null;
    this.activeProfile = null;
  }

  async generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult> {
    console.log("[NASUKI][ENGINE][7] GENERATE_START");
    if (!this.activeContext || this.status !== "READY") {
        console.error(`[NASUKI][ENGINE] Model not loaded. Status: ${this.status}, ActiveContext: ${this.activeContext !== null}`);
        throw new Error("Model not loaded");
    }

    if (this.currentOperationInProgress) {
        console.error("[NASUKI][ENGINE] Generation already in progress");
        throw new Error("Generation already in progress");
    }

    console.log(`[NASUKI][ANDROID][LLAMA] Generation using Context ID: ${this.contextId} (Profile: ${this.activeProfile})`);

    // Memory Gate for Generation
    if (!(await this.checkMemorySafety("GENERATION"))) {
        return {
            text: "",
            metrics: {},
            error: "Insufficient memory to start generation.",
            errorCode: "OUT_OF_MEMORY"
        };
    }

    this.currentOperationInProgress = true;
    const startTime = Date.now();
    let firstTokenTimeMs: number | null = null;
    let tokenCount = 0;
    let accumulatedText = "";

    try {
      console.log("[NASUKI][ENGINE][8] COMPLETION_START");
      console.log(`[NASUKI][ENGINE] completion config: n_predict=${options?.maxTokens || 256}, temp=${options?.temperature || 0.7}, top_p=${options?.topP || 0.9}, stop=${JSON.stringify(options?.stopSequences || [])}`);

      const result = await this.activeContext.completion(
        {
          prompt,
          n_predict: options?.maxTokens || 256,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP || 0.9,
          stop: options?.stopSequences || [],
        },
        (data: { token: string }) => {
          if (firstTokenTimeMs === null) {
            firstTokenTimeMs = Date.now() - startTime;
            console.log("[NASUKI][ENGINE][9] FIRST_TOKEN:", JSON.stringify(data.token));
          }
          tokenCount++;
          if (tokenCount <= 5) {
            console.log(`[NASUKI][ENGINE] TOKEN_CALLBACK [${tokenCount}]:`, JSON.stringify(data.token));
          }
          accumulatedText += data.token;
          options?.onToken?.(data.token);
        }
      );

      console.log("[NASUKI][ENGINE][10] COMPLETION_RETURNED. Raw text len:", result?.text?.length ?? 0, "Accumulated text len:", accumulatedText.length);
      const finalText = (result?.text || accumulatedText).trim();
      console.log("[NASUKI][ENGINE][11] GENERATION_RESULT:", JSON.stringify(finalText));

      const endTime = Date.now();

      const metrics: InferenceMetrics = {
        generationTimeMs: endTime - startTime,
        firstTokenLatencyMs: firstTokenTimeMs ?? undefined,
        tokenCount: tokenCount,
        tokensPerSec: tokenCount / Math.max((endTime - startTime) / 1000, 0.001)
      };

      return {
        text: finalText,
        metrics
      };
    } catch (e: any) {
      console.error("[NASUKI][ENGINE] Completion Exception:", e);
      return {
        text: accumulatedText,
        metrics: {},
        error: e.message,
        errorCode: /memory|oom/i.test(e.message) ? "OUT_OF_MEMORY" : "GENERATION_ERROR"
      };
    } finally {
      this.currentOperationInProgress = false;
    }
  }

  async stopGeneration(): Promise<void> {
    if (this.activeContext) {
      await this.activeContext.stopCompletion();
    }
  }
}

export const engine = new AndroidInferenceEngine();
