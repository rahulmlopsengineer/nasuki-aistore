// ============================================================
// NASUKI LOCAL INFERENCE POC
// ============================================================
// Purpose:
// - Select GGUF using Android system file picker
// - Copy model into app-private storage
// - NEVER load GGUF directly from /sdcard/Download
// - Normalize file:// URI before passing to llama.rn
// - Load model with llama.rn
// - Run local inference
// - Stream tokens
// - Provide detailed logs
//
// Expo SDK: 57
// React Native: 0.86
// ============================================================

import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initLlama } from "llama.rn";
import * as DeviceDiagnostics from "./DeviceDiagnostics";

// ============================================================
// TYPES
// ============================================================

export interface BenchmarkResult {
  id: string;
  type: "thread_sweep" | "context_sweep" | "sustained_burn" | "residency_validation" | "ram_pressure" | "stress_test";
  timestamp: number;
  config: {
    threads: number;
    context: number;
    batch: number;
    adaptive: boolean;
  };
  performance: {
    prefillTps: number;
    decodeTps: number;
    latencyMs: number;
    totalTokens?: number;
  };
  hardware: DeviceDiagnostics.HardwareStatus;
  samples: DeviceDiagnostics.TelemetrySample[];
  paging?: {
    minorFaultDelta: number;
    majorFaultDelta: number;
  };
  adpf?: {
    enabled: boolean;
    workerCount: number;
    targetDurationNanos: number;
    actualDurationNanos: number;
  };
  gpu?: {
    backend: string;
    device: string;
    nGpuLayers: number;
  };
  health?: {
    normalPercent: number;
    throttledPercent: number;
  };
}

export interface BenchmarkReport {
  schemaVersion: number;
  results: BenchmarkResult[];
}

export type QualityAction =
  | "KEEP"
  | "REDUCE_THREADS"
  | "REDUCE_CONTEXT"
  | "RESTORE_THREADS"
  | "RESTORE_CONTEXT";

export interface QualityDecision {
  action: QualityAction;
  reason: string;
  targetThreads?: number;
  targetContext?: number;
  timestamp: number;
}

export interface DeviceProfile {
  optimalThreads: number;
  maxThreads: number;
  benchmarkDate: number;
  avgTokensPerSec: number;
  ramGb: number;
}

export type POCModelStatus =
  | "UNLOADED"
  | "LOADING"
  | "READY"
  | "GENERATING"
  | "ERROR";

export type POCErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_PICK_CANCELLED"
  | "MODEL_COPY_FAILED"
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

export interface POCModelInfo {
  success: boolean;
  uri?: string;
  nativePath?: string;
  name?: string;
  sizeBytes?: number;
  error?: string;
}

// ============================================================
// MODEL CONFIG
// ============================================================

export const DEFAULT_MODEL_FILENAME =
  "gemma-2-2b-it-Q4_K_M.gguf";

const MODEL_DIRECTORY_NAME = "models";

const STORAGE_KEY_DEVICE_PROFILE = "@nasuki/device_profile";

// Conservative settings for 4–6 GB Android devices.
const MODEL_CONTEXT_SIZE = 200;
const MODEL_THREADS = 3;
const MODEL_GPU_LAYERS = 2;
const BENCHMARK_TOKENS = 32;

// ============================================================
// ADAPTIVE CONTROLLER STATE
// ============================================================

let cachedProfile: DeviceProfile | null = null;

// ============================================================
// ADAPTIVE STATE
// ============================================================

export enum AdaptiveQualityLevel {
  MAXIMUM = 0,
  REDUCED_CPU = 1,
  THROTTLED = 2,
  CRITICAL = 3,
}

// Configurable Heuristics
const THERMAL_VELOCITY_THRESHOLD = 0.05; // headroom units / sec
const RAM_SAFEGUARD_MARGIN_MB = 500;
const INFERENCE_LATENCY_BUDGET_MS = 250; // ms per token
const MINIMUM_DWELL_TIME_MS = 30000; // 30 seconds

class QualityGovernor {
  private samples: DeviceDiagnostics.TelemetrySample[] = [];
  private windowSize = 15;
  private lastTransitionTime = 0;
  private currentDecision: QualityDecision | null = null;

  addSample(sample: DeviceDiagnostics.TelemetrySample) {
    this.samples.push(sample);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  getDecision(): QualityDecision {
    const now = Date.now();
    const lastSample = this.samples[this.samples.length - 1];

    if (!lastSample) return { action: "KEEP", reason: "NO_DATA", timestamp: now };

    // 1. SAFETY FIRST: Critical Conditions
    if (lastSample.thermalStatus >= 3 || lastSample.thermalHeadroom > 0.95) {
      return this.makeDecision("REDUCE_THREADS", "CRITICAL_THERMAL", 1);
    }

    if (lastSample.availableRamMB < 300 || lastSample.lowMemory) {
      return this.makeDecision("REDUCE_CONTEXT", "CRITICAL_MEMORY", undefined, 512);
    }

    // 2. HYSTERESIS: Dwell Time
    if (now - this.lastTransitionTime < MINIMUM_DWELL_TIME_MS) {
      return { action: "KEEP", reason: "DWELL_TIME", timestamp: now };
    }

    // 3. TREND ANALYSIS
    const tVelocity = DeviceDiagnostics.calculateThermalVelocity(this.samples);
    const rVelocity = DeviceDiagnostics.calculateRamVelocity(this.samples);

    if (tVelocity > THERMAL_VELOCITY_THRESHOLD) {
      return this.makeDecision("REDUCE_THREADS", "PREDICTIVE_HEATING");
    }

    if (lastSample.availableRamMB < RAM_SAFEGUARD_MARGIN_MB && rVelocity < 0) {
      return this.makeDecision("REDUCE_CONTEXT", "MEMORY_PRESSURE_TREND");
    }

    // 4. RECOVERY
    if (lastSample.thermalStatus === 0 && lastSample.thermalHeadroom < 0.4 && lastSample.availableRamMB > RAM_SAFEGUARD_MARGIN_MB * 1.5) {
        return this.makeDecision("RESTORE_THREADS", "RECOVERY_IDLE");
    }

    return { action: "KEEP", reason: "STABLE", timestamp: now };
  }

  private makeDecision(action: QualityAction, reason: string, threads?: number, context?: number): QualityDecision {
    const now = Date.now();
    this.lastTransitionTime = now;
    const decision = { action, reason, targetThreads: threads, targetContext: context, timestamp: now };
    this.currentDecision = decision;
    return decision;
  }

  getLastDecision() { return this.currentDecision; }
}

const governor = new QualityGovernor();
let currentQualityLevel: AdaptiveQualityLevel = AdaptiveQualityLevel.MAXIMUM;
let currentAdaptiveThreads: number | null = null;
let currentAdaptiveContext: number = MODEL_CONTEXT_SIZE;
let lastThermalStatus: number = 0; // 0 = NORMAL
let adaptiveThrottleActive: boolean = false;
let adpfSupported: boolean = false;
let adpfSessionActive: boolean = false;
let benchmarkAdpfEnabled: boolean = true;
let isAdaptiveEnabled: boolean = true;

const ADAPTIVE_POLL_INTERVAL = 1500; // 1.5 seconds
let adaptivePollTimer: any = null;
let isPollingActive = false;

// ============================================================
// APP PRIVATE MODEL DIRECTORY
// ============================================================

export const getModelDirectory = (): string => {
  if (!FileSystem.documentDirectory) {
    return "";
  }

  return `${FileSystem.documentDirectory}${MODEL_DIRECTORY_NAME}/`;
};

// ============================================================
// DEFAULT PRIVATE MODEL PATH
// ============================================================

export const getDefaultModelPath = (): string => {
  return `${getModelDirectory()}${DEFAULT_MODEL_FILENAME}`;
};

// ============================================================
// NATIVE PATH NORMALIZATION
// ============================================================
//
// Expo FileSystem normally gives us:
//
// file:///data/user/0/.../files/models/model.gguf
//
// llama.rn native Android expects a normal filesystem path:
//
// /data/user/0/.../files/models/model.gguf
//
// Therefore we strip file:// before initLlama().
//
// ============================================================

function toNativePath(uri: string): string {
  if (!uri) {
    return uri;
  }

  if (uri.startsWith("file://")) {
    return uri.replace(/^file:\/\//, "");
  }

  return uri;
}

// ============================================================
// URI NORMALIZATION FOR EXPO FILESYSTEM
// ============================================================

function toFileUri(path: string): string {
  if (!path) {
    return path;
  }

  if (
    path.startsWith("file://") ||
    path.startsWith("content://")
  ) {
    return path;
  }

  if (path.startsWith("/")) {
    return `file://${path}`;
  }

  return path;
}

// ============================================================
// CHECK WHETHER PATH IS APP PRIVATE
// ============================================================

function isPrivateModelPath(path: string): boolean {
  const modelDirectory = getModelDirectory();

  if (!modelDirectory) {
    return false;
  }

  const normalizedPath = path.replace(/^file:\/\//, "");
  const normalizedDirectory =
    modelDirectory.replace(/^file:\/\//, "");

  return normalizedPath.startsWith(normalizedDirectory);
}

// ============================================================
// ACTIVE LLAMA CONTEXT
// ============================================================

let activeContext: any = null;

let currentStatus: POCModelStatus =
  "UNLOADED";

let currentModelPath: string | null = null;

// ============================================================
// ENSURE MODEL DIRECTORY
// ============================================================

async function ensureModelDirectory(): Promise<string> {
  const directory = getModelDirectory();

  if (!directory) {
    throw new Error(
      "Expo document directory is unavailable."
    );
  }

  const info =
    await FileSystem.getInfoAsync(directory);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(
      directory,
      {
        intermediates: true,
      }
    );
  }

  return directory;
}

// ============================================================
// CHECK FILE
// ============================================================

async function getFileInfo(path: string) {
  return await FileSystem.getInfoAsync(path);
}

// ============================================================
// SELECT + IMPORT MODEL
// ============================================================

async function importModel(): Promise<POCModelInfo> {
  console.log(
    "[NASUKI][MODEL] ========================================"
  );

  console.log(
    "[NASUKI][MODEL] OPENING DOCUMENT PICKER"
  );

  console.log(
    "[NASUKI][MODEL] ========================================"
  );

  try {
    const result =
      await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

    // --------------------------------------------------------
    // USER CANCELLED
    // --------------------------------------------------------

    if (result.canceled) {
      console.log(
        "[NASUKI][MODEL] User cancelled model selection."
      );

      return {
        success: false,
        error: "Model selection cancelled.",
      };
    }

    // --------------------------------------------------------
    // ASSET
    // --------------------------------------------------------

    const asset = result.assets?.[0];

    if (!asset) {
      return {
        success: false,
        error:
          "No file was returned by document picker.",
      };
    }

    console.log(
      "[NASUKI][MODEL] Selected name:",
      asset.name
    );

    console.log(
      "[NASUKI][MODEL] Selected URI:",
      asset.uri
    );

    console.log(
      "[NASUKI][MODEL] Selected size:",
      asset.size
    );

    // --------------------------------------------------------
    // GGUF VALIDATION
    // --------------------------------------------------------

    if (
      !asset.name
        .toLowerCase()
        .endsWith(".gguf")
    ) {
      return {
        success: false,
        error:
          "Selected file is not a GGUF model.",
      };
    }

    // --------------------------------------------------------
    // PRIVATE DIRECTORY
    // --------------------------------------------------------

    const modelsDir =
      await ensureModelDirectory();

    console.log(
      "[NASUKI][MODEL] Private directory:",
      modelsDir
    );

    // --------------------------------------------------------
    // SAFE DESTINATION NAME
    // --------------------------------------------------------

    const safeFilename =
      asset.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    const destination =
      `${modelsDir}${safeFilename}`;

    console.log(
      "[NASUKI][MODEL] Destination URI:",
      destination
    );

    console.log(
      "[NASUKI][MODEL] Destination native path:",
      toNativePath(destination)
    );

    // --------------------------------------------------------
    // EXISTING FILE
    // --------------------------------------------------------

    const existing =
      await FileSystem.getInfoAsync(
        destination
      );

    if (
      existing.exists &&
      !existing.isDirectory
    ) {
      console.log(
        "[NASUKI][MODEL] Existing model found."
      );

      if (
        asset.size &&
        existing.size === asset.size
      ) {
        console.log(
          "[NASUKI][MODEL] Existing model size matches."
        );

        return {
          success: true,
          uri: destination,
          nativePath:
            toNativePath(destination),
          name: safeFilename,
          sizeBytes: existing.size,
        };
      }

      console.log(
        "[NASUKI][MODEL] Existing model differs. Removing it."
      );

      await FileSystem.deleteAsync(
        destination,
        {
          idempotent: true,
        }
      );
    }

    // --------------------------------------------------------
    // SOURCE CHECK
    // --------------------------------------------------------

    const sourceInfo =
      await FileSystem.getInfoAsync(
        asset.uri
      );

    console.log(
      "[NASUKI][MODEL] Source exists:",
      sourceInfo.exists
    );

    console.log(
      "[NASUKI][MODEL] Selected size:",
      (sourceInfo as any).size
    );

    if (!sourceInfo.exists) {
      return {
        success: false,
        error:
          "Selected model source is no longer available.",
      };
    }

    // --------------------------------------------------------
    // COPY
    // --------------------------------------------------------

    console.log(
      "[NASUKI][MODEL] Copying model to private storage..."
    );

    const copyStart =
      Date.now();

    await FileSystem.copyAsync({
      from: asset.uri,
      to: destination,
    });

    const copyTime =
      Date.now() - copyStart;

    console.log(
      "[NASUKI][MODEL] Copy completed in:",
      copyTime,
      "ms"
    );

    // --------------------------------------------------------
    // DESTINATION VERIFICATION
    // --------------------------------------------------------

    const copied =
      await FileSystem.getInfoAsync(
        destination
      );

    console.log(
      "[NASUKI][MODEL] Destination exists:",
      copied.exists
    );

    console.log(
      "[NASUKI][MODEL] Destination size:",
      (copied as any).size
    );

    if (
      !copied.exists ||
      copied.isDirectory
    ) {
      throw new Error(
        "Model copy completed but destination does not exist."
      );
    }

    // --------------------------------------------------------
    // SIZE VERIFICATION
    // --------------------------------------------------------

    if (
      asset.size &&
      (copied as any).size !== asset.size
    ) {
      await FileSystem.deleteAsync(
        destination,
        {
          idempotent: true,
        }
      );

      throw new Error(
        `Model size verification failed. ` +
        `Source=${asset.size}, ` +
        `Destination=${copied.size}`
      );
    }

    // --------------------------------------------------------
    // PRIVATE PATH VERIFICATION
    // --------------------------------------------------------

    if (!isPrivateModelPath(destination)) {
      throw new Error(
        "Security check failed: model is not inside app-private storage."
      );
    }

    console.log(
      "[NASUKI][MODEL] ========================================"
    );

    console.log(
      "[NASUKI][MODEL] MODEL IMPORT SUCCESS"
    );

    console.log(
      "[NASUKI][MODEL] Private URI:",
      destination
    );

    console.log(
      "[NASUKI][MODEL] Native path:",
      toNativePath(destination)
    );

    console.log(
      "[NASUKI][MODEL] Size:",
      copied.size
    );

    console.log(
      "[NASUKI][MODEL] ========================================"
    );

    return {
      success: true,
      uri: destination,
      nativePath:
        toNativePath(destination),
      name: safeFilename,
      sizeBytes: copied.size,
    };
  } catch (error: any) {
    console.error(
      "[NASUKI][MODEL] Import failed:",
      error
    );

    return {
      success: false,
      error:
        error?.message ||
        String(error),
    };
  }
}

// ============================================================
// CHECK PRIVATE MODEL
// ============================================================

async function checkModelFile(
  targetPath?: string
) {
  const path =
    targetPath ||
    getDefaultModelPath();

  console.log(
    "[NASUKI][LLAMA] Checking:",
    path
  );

  try {
    const info =
      await FileSystem.getInfoAsync(path);

    console.log(
      "[NASUKI][LLAMA] Exists:",
      info.exists
    );

    console.log(
      "[NASUKI][LLAMA] Size:",
      (info as any).size
    );

    console.log(
      "[NASUKI][LLAMA] Is directory:",
      info.isDirectory
    );

    return {
      exists:
        info.exists &&
        !info.isDirectory,
      path,
      sizeBytes:
        info.exists &&
        !info.isDirectory
          ? (info as any).size
          : undefined,
    };
  } catch (error: any) {
    console.error(
      "[NASUKI][LLAMA] File check failed:",
      error
    );

    return {
      exists: false,
      path,
    };
  }
}

// ============================================================
// LOAD MODEL
// ============================================================

async function loadModel(
  modelPath?: string,
  onProgress?: (progress: number) => void,
  customThreads?: number,
  customGpuLayers?: number
) {
  // Reset adaptive state on new load
  currentAdaptiveThreads = null;
  adaptiveThrottleActive = false;

  if (adaptivePollTimer) {
    clearInterval(adaptivePollTimer);
    adaptivePollTimer = null;
  }
  console.log(
    "=================================================="
  );

  console.log(
    "[NASUKI][LLAMA] MODEL LOAD START"
  );

  console.log(
    "=================================================="
  );

  if (Platform.OS !== "android") {
    currentStatus = "ERROR";

    return {
      success: false,
      error:
        "This POC currently targets Android.",
      errorCode:
        "UNSUPPORTED_PLATFORM" as POCErrorCode,
    };
  }

  try {
    // --------------------------------------------------------
    // DETERMINE MODEL URI
    // --------------------------------------------------------

    let path =
      modelPath ||
      currentModelPath ||
      getDefaultModelPath();

    console.log(
      "[NASUKI][LLAMA] Requested model URI:",
      path
    );

    // --------------------------------------------------------
    // IMPORTANT:
    // NEVER PASS /sdcard/Download DIRECTLY TO LLAMA.RN
    // --------------------------------------------------------

    if (!isPrivateModelPath(path)) {
      console.warn(
        "[NASUKI][LLAMA] External model path detected."
      );

      console.log(
        "[NASUKI][LLAMA] Importing model into private storage..."
      );

      const imported =
        await importModel();

      if (
        !imported.success ||
        !imported.uri
      ) {
        currentStatus = "ERROR";

        return {
          success: false,
          error:
            imported.error ||
            "Model import failed.",
          errorCode:
            "MODEL_COPY_FAILED" as POCErrorCode,
        };
      }

      path = imported.uri;
    }

    // --------------------------------------------------------
    // VERIFY PRIVATE FILE
    // --------------------------------------------------------

    const fileCheck =
      await checkModelFile(path);

    if (!fileCheck.exists) {
      currentStatus = "ERROR";

      return {
        success: false,
        error:
          `Model not found: ${path}`,
        errorCode:
          "MODEL_NOT_FOUND" as POCErrorCode,
      };
    }

    // --------------------------------------------------------
    // RELEASE PREVIOUS CONTEXT
    // --------------------------------------------------------

    if (activeContext) {
      await releaseModel();
    }

    currentStatus = "LOADING";

    const startTime =
      Date.now();

    // --------------------------------------------------------
    // NATIVE PATH
    // --------------------------------------------------------

    const nativeModelPath =
      toNativePath(path);

    // --------------------------------------------------------
    // FINAL SAFETY CHECK
    // --------------------------------------------------------

    if (
      nativeModelPath.includes(
        "/sdcard/Download/"
      )
    ) {
      throw new Error(
        "Unsafe model path: llama.rn cannot load directly from Download."
      );
    }

    console.log(
      "[NASUKI][LLAMA] ----------------------------------------"
    );

    console.log(
      "[NASUKI][LLAMA] PRIVATE MODEL CONFIRMED"
    );

    console.log(
      "[NASUKI][LLAMA] URI:",
      path
    );

    console.log(
      "[NASUKI][LLAMA] Native path:",
      nativeModelPath
    );

    console.log(
      "[NASUKI][LLAMA] Size:",
      fileCheck.sizeBytes
    );

    console.log(
      "[NASUKI][LLAMA] ----------------------------------------"
    );

    // --------------------------------------------------------
    // LOAD LLAMA.RN
    // --------------------------------------------------------

    console.log(
      "[NASUKI][LLAMA] Loading llama.rn..."
    );

    const llamaModule =
      require("llama.rn");

    console.log(
      "[NASUKI][LLAMA] llama.rn loaded."
    );

    console.log(
      "[NASUKI][LLAMA] initLlama:",
      typeof llamaModule.initLlama
    );

    // --------------------------------------------------------
    // RUNTIME CONFIGURATION
    // --------------------------------------------------------

    const optimalConfig = await getOptimalConfig();
    const threadsToUse = customThreads || currentAdaptiveThreads || optimalConfig.threads;

    const config = {
      model: nativeModelPath,

      n_ctx:
        currentAdaptiveContext,

      n_threads:
        threadsToUse,

      n_gpu_layers:
        customGpuLayers !== undefined ? customGpuLayers : MODEL_GPU_LAYERS,

      use_mmap: true,

      use_mlock: false,
    };

    console.log(
      "[NASUKI][LLAMA] Runtime config:",
      config
    );

    // --------------------------------------------------------
    // PHASE 3.1: WARMUP WEIGHTS (MADV_WILLNEED)
    // --------------------------------------------------------
    try {
        console.log("[NASUKI][ADAPTIVE] Warming up model weights into Page Cache...");
        await DeviceDiagnostics.warmupModel(nativeModelPath);
    } catch (e) {
        console.warn("[NASUKI][ADAPTIVE] Warmup failed (non-critical):", e);
    }

    // --------------------------------------------------------
    // INITIALIZE
    // --------------------------------------------------------

    console.log(
      "[NASUKI][LLAMA] Calling initLlama..."
    );

    activeContext =
      await llamaModule.initLlama(
        config,
        (progress: number) => {
          console.log(
            `[NASUKI][LLAMA] Loading: ${progress}%`
          );

          onProgress?.(
            progress
          );
        }
      );

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    currentModelPath =
      path;

    currentStatus =
      "READY";

    // --------------------------------------------------------
    // START ADAPTIVE MONITORING
    // --------------------------------------------------------

    adpfSupported = await DeviceDiagnostics.isPerformanceHintSupported();
    await DeviceDiagnostics.registerThermalListener();
    startAdaptivePolling();

    const loadTimeMs =
      Date.now() - startTime;

    console.log(
      "=================================================="
    );

    console.log(
      "[NASUKI][LLAMA] MODEL LOADED SUCCESSFULLY"
    );

    console.log(
      "[NASUKI][LLAMA] Load time:",
      loadTimeMs,
      "ms"
    );

    console.log(
      "=================================================="
    );

    return {
      success: true,
      loadTimeMs,
    };
  } catch (error: any) {
    currentStatus = "ERROR";

    console.error(
      "=================================================="
    );

    console.error(
      "[NASUKI][LLAMA] MODEL LOAD FAILED"
    );

    console.error(
      "[NASUKI][LLAMA] Error:",
      error
    );

    console.error(
      "=================================================="
    );

    const message =
      error?.message ||
      String(error);

    // --------------------------------------------------------
    // ERROR CLASSIFICATION
    // --------------------------------------------------------

    const isOOM =
      /memory|oom|out[\s_-]*of[\s_-]*memory|allocate|allocation|mmap|cannot allocate/i.test(
        message
      );

    const isNativeError =
      /native|jni|llama|cpp|c\+\+|abort|signal|segmentation/i.test(
        message
      );

    // --------------------------------------------------------
    // RELEASE FAILED CONTEXT
    // --------------------------------------------------------

    if (activeContext) {
      try {
        await activeContext.release();
      } catch {}

      activeContext =
        null;
    }

    return {
      success: false,
      error:
        `Failed to load model: ${message}`,
      errorCode:
        isOOM
          ? ("OUT_OF_MEMORY" as POCErrorCode)
          : isNativeError
          ? ("NATIVE_RUNTIME_ERROR" as POCErrorCode)
          : ("MODEL_LOAD_FAILED" as POCErrorCode),
    };
  }
}

// ============================================================
// GENERATE
// ============================================================

async function generate(
  prompt: string,
  onToken?: (token: string) => void
): Promise<POCGenerationResult> {
  if (!activeContext) {
    return {
      text: "",
      metrics: {},
      error:
        "Model is not loaded.",
      errorCode:
        "MODEL_LOAD_FAILED",
    };
  }

  // --------------------------------------------------------
  // START PERFORMANCE SESSION (ADPF)
  // --------------------------------------------------------
  if (adpfSupported && benchmarkAdpfEnabled) {
    try {
      const tids = await activeContext.getWorkerTids();
      if (tids && tids.length > 0) {
        // Target: 100ms per token (10 tok/sec)
        await DeviceDiagnostics.startPerformanceSession(tids, 100 * 1000000);
        adpfSessionActive = true;
      }
    } catch (e) {
      console.warn("[NASUKI][ADAPTIVE] Failed to start ADPF session:", e);
    }
  }

  currentStatus =
    "GENERATING";

  const startTime =
    Date.now();

  let firstTokenTime:
    number | null = null;

  let tokenCount = 0;

  let accumulatedText = "";

  try {
    console.log(
      "[NASUKI][LLAMA] Generation started."
    );

    // --------------------------------------------------------
    // GEMMA 2 CHAT FORMAT
    // --------------------------------------------------------

    const formattedPrompt =
      `<start_of_turn>user\n` +
      `${prompt.trim()}` +
      `<end_of_turn>\n` +
      `<start_of_turn>model\n`;

    const result =
      await activeContext.completion(
        {
          prompt:
            formattedPrompt,

          n_predict: 128,

          temperature: 0.7,

          top_p: 0.9,

          stop: [
            "<end_of_turn>",
            "<eos>",
            "<start_of_turn>",
          ],
        },

        (data: {
          token: string;
        }) => {
          if (
            firstTokenTime === null
          ) {
            firstTokenTime =
              Date.now() -
              startTime;
          }

          tokenCount++;

          accumulatedText +=
            data.token;

          onToken?.(
            data.token
          );
        }
      );

    // --------------------------------------------------------
    // METRICS
    // --------------------------------------------------------

    const totalTimeMs =
      Date.now() -
      startTime;

    const finalText =
      (
        result?.text ||
        accumulatedText
      ).trim();

    const actualTokens =
      result?.timings
        ?.predicted_n ||
      tokenCount;

    const tokensPerSec =
      result?.timings
        ?.predicted_per_second ||
      (
        actualTokens > 0 &&
        totalTimeMs > 0
          ? actualTokens /
            (totalTimeMs / 1000)
          : 0
      );

    currentStatus =
      "READY";

    // --------------------------------------------------------
    // REPORT PERFORMANCE (ADPF)
    // --------------------------------------------------------
    if (adpfSessionActive) {
      try {
        // Report average duration per token
        const actualNanos = (totalTimeMs / actualTokens) * 1000000;
        await DeviceDiagnostics.reportActualWorkDuration(actualNanos);
      } catch {}
    }

    console.log(
      "[NASUKI][LLAMA] Generation completed."
    );

    console.log(
      "[NASUKI][LLAMA] Tokens:",
      actualTokens
    );

    console.log(
      "[NASUKI][LLAMA] Tokens/sec:",
      tokensPerSec
    );

    return {
      text: finalText,

      metrics: {
        generationTimeMs:
          totalTimeMs,

        firstTokenTimeMs:
          firstTokenTime ??
          undefined,

        tokenCount:
          actualTokens,

        tokensPerSec:
          Number(
            tokensPerSec.toFixed(2)
          ),

        contextSize:
          MODEL_CONTEXT_SIZE,

        promptTokens:
          result?.timings
            ?.prompt_n,
      },
    };
  } catch (error: any) {
    currentStatus =
      "ERROR";

    const message =
      error?.message ||
      String(error);

    const isOOM =
      /memory|oom|out[\s_-]*of[\s_-]*memory|allocate|allocation/i.test(
        message
      );

    return {
      text:
        accumulatedText,

      metrics: {
        generationTimeMs:
          Date.now() -
          startTime,

        tokenCount,
      },

      error:
        `Inference failed: ${message}`,

      errorCode:
        isOOM
          ? "OUT_OF_MEMORY"
          : "GENERATION_ERROR",
    };
  }
}

// ============================================================
// STOP GENERATION
// ============================================================

async function stopGeneration() {
  if (!activeContext) {
    return;
  }

  try {
    await activeContext.stopCompletion();
  } catch (error) {
    console.warn(
      "[NASUKI][LLAMA] Stop error:",
      error
    );
  }

  if (
    currentStatus ===
    "GENERATING"
  ) {
    currentStatus =
      "READY";
  }
}

// ============================================================
// RELEASE MODEL
// ============================================================

async function releaseModel() {
  console.log(
    "[NASUKI][LLAMA] Releasing model..."
  );

  if (adaptivePollTimer) {
    clearInterval(adaptivePollTimer);
    adaptivePollTimer = null;
  }

  if (adpfSessionActive) {
    try {
      await DeviceDiagnostics.closePerformanceSession();
      adpfSessionActive = false;
    } catch {}
  }

  if (activeContext) {
    try {
      await activeContext.release();
    } catch (error) {
      console.warn(
        "[NASUKI][LLAMA] Release error:",
        error
      );
    }

    activeContext =
      null;
  }

  currentModelPath =
    null;

  currentStatus =
    "UNLOADED";
}

// ============================================================
// ADAPTIVE LOGIC
// ============================================================

function startAdaptivePolling() {
  if (isPollingActive) return;
  isPollingActive = true;

  if (adaptivePollTimer) clearInterval(adaptivePollTimer);

  adaptivePollTimer = setInterval(async () => {
    if (currentStatus !== "GENERATING" && currentStatus !== "LOADING") {
       // Reduce frequency when idle
       if (Date.now() % 5000 > 1500) return;
    }
    try {
      const status = await DeviceDiagnostics.getHardwareStatus();
      const sysMem = await DeviceDiagnostics.getSystemMemoryStats();
      lastThermalStatus = status.thermalStatus;

      const sample: DeviceDiagnostics.TelemetrySample = {
        ...status,
        elapsedMs: 0
      };

      // Update hardware status with system-level file cache info if needed
      // (For now just log it for analysis)
      console.log(`[NASUKI][ADAPTIVE] RAM: ${status.availableRamMB}MB, Cached: ${Math.round(sysMem.cachedBytes/1024/1024)}MB`);

      governor.addSample(sample);

      if (!isAdaptiveEnabled) {
          console.log(`[NASUKI][ADAPTIVE] Monitoring ONLY (Disabled). Thermal: ${status.thermalStatus}, Headroom: ${status.thermalHeadroom.toFixed(2)}`);
          return;
      }

      const decision = governor.getDecision();

      if (decision.action !== "KEEP") {
        console.warn(`[NASUKI][ADAPTIVE] Decision: ${decision.action} Reason: ${decision.reason}`);

        const config = await getOptimalConfig();

        switch (decision.action) {
          case "REDUCE_THREADS":
            currentAdaptiveThreads = Math.max(1, (currentAdaptiveThreads || config.threads) - 1);
            break;
          case "REDUCE_CONTEXT":
            currentAdaptiveContext = Math.max(256, Math.floor(currentAdaptiveContext / 2));
            break;
          case "RESTORE_THREADS":
            if (currentAdaptiveThreads && currentAdaptiveThreads < config.threads) {
                currentAdaptiveThreads++;
            } else {
                currentAdaptiveThreads = null; // Revert to optimal
            }
            break;
          case "RESTORE_CONTEXT":
            currentAdaptiveContext = Math.min(MODEL_CONTEXT_SIZE, currentAdaptiveContext * 2);
            break;
        }
      }

      console.log(`[NASUKI][ADAPTIVE] Thermal: ${status.thermalStatus}, Headroom: ${status.thermalHeadroom.toFixed(2)}, Threads: ${currentAdaptiveThreads || 'OPT'}, CTX: ${currentAdaptiveContext}`);
    } catch (e) {
      console.error("[NASUKI][ADAPTIVE] Polling error:", e);
    }
  }, ADAPTIVE_POLL_INTERVAL);
}

// ============================================================
// BENCHMARK ENGINE
// ============================================================

const STORAGE_KEY_BENCHMARK_RESULTS = "@nasuki/benchmark_results";
const BENCHMARK_PROMPT = "The capital of France is Paris. The capital of Germany is Berlin. The capital of Japan is Tokyo. List three more examples.";

async function waitForCooldown() {
  console.log("[NASUKI][BENCHMARK] Waiting for thermal recovery...");
  let attempts = 0;
  while (attempts < 30) {
    const status = await DeviceDiagnostics.getHardwareStatus();
    if (status.thermalStatus === 0 && status.thermalHeadroom < 0.5) {
      console.log("[NASUKI][BENCHMARK] Cooldown complete.");
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
  }
  console.warn("[NASUKI][BENCHMARK] Cooldown timed out, continuing anyway.");
}

/**
 * Sweeps thread counts to find the efficiency peak.
 */
async function runThreadSweep(modelPath?: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const cpuInfo = await DeviceDiagnostics.getCpuInfo();
  const maxThreads = Math.min(cpuInfo.availableProcessors, 8);

  for (let t = 1; t <= maxThreads; t++) {
    console.log(`[NASUKI][BENCHMARK] Thread Sweep: Testing ${t} threads...`);

    const loadResult = await loadModel(modelPath, undefined, t);
    if (!loadResult.success) break;

    // Prefill test
    const startStatus = await DeviceDiagnostics.getHardwareStatus();
    const bench = await generate(BENCHMARK_PROMPT);
    const endStatus = await DeviceDiagnostics.getHardwareStatus();

    results.push({
      id: `thread_${t}_${Date.now()}`,
      type: "thread_sweep",
      timestamp: Date.now(),
      config: { threads: t, context: currentAdaptiveContext, batch: 512, adaptive: false },
      performance: {
        prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
        decodeTps: bench.metrics.tokensPerSec || 0,
        latencyMs: bench.metrics.generationTimeMs || 0
      },
      hardware: endStatus,
      samples: []
    });

    await releaseModel();

    // Knee Detection: Stop if efficiency drops significantly
    if (t > 1) {
        const prev = results[results.length - 2].performance.decodeTps;
        if (bench.metrics.tokensPerSec! < prev * 1.05) {
            console.log("[NASUKI][BENCHMARK] Knee detected. Stopping sweep.");
            break;
        }
    }

    await waitForCooldown();
  }

  await saveBenchmarkResults(results);
  return results;
}

/**
 * Continuous generation to measure thermal slope.
 */
async function runSustainedBurn(durationSeconds: number = 60, modelPath?: string): Promise<BenchmarkResult> {
  console.log(`[NASUKI][BENCHMARK] Starting Sustained Burn for ${durationSeconds}s...`);

  const loadResult = await loadModel(modelPath);
  if (!loadResult.success) throw new Error("Load failed");

  const samples: DeviceDiagnostics.TelemetrySample[] = [];
  const startTime = Date.now();

  const collector = setInterval(async () => {
    const status = await DeviceDiagnostics.getHardwareStatus();
    samples.push({
      ...status,
      elapsedMs: Date.now() - startTime
    });
  }, 2000);

  // Large prompt to keep it busy
  const result = await generate("Write a very long detailed history of the Roman Empire, including all major emperors and battles. Continue until stopped.");

  clearInterval(collector);
  await releaseModel();

  const report: BenchmarkResult = {
    id: `burn_${Date.now()}`,
    type: "sustained_burn",
    timestamp: Date.now(),
    config: { threads: currentAdaptiveThreads || 4, context: currentAdaptiveContext, batch: 512, adaptive: false },
    performance: {
      prefillTps: result.metrics.promptTokens ? result.metrics.promptTokens / (result.metrics.firstTokenTimeMs! / 1000) : 0,
      decodeTps: result.metrics.tokensPerSec || 0,
      latencyMs: result.metrics.generationTimeMs || 0
    },
    hardware: samples[samples.length - 1],
    samples: samples
  };

  await saveBenchmarkResults([report]);
  return report;
}

async function saveBenchmarkResults(newResults: BenchmarkResult[]) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY_BENCHMARK_RESULTS);
    const report: BenchmarkReport = existing ? JSON.parse(existing) : { schemaVersion: 1, results: [] };
    report.results.push(...newResults);
    await AsyncStorage.setItem(STORAGE_KEY_BENCHMARK_RESULTS, JSON.stringify(report));
  } catch (e) {
    console.error("Failed to save benchmarks", e);
  }
}

/**
 * Validates if the model remains resident across repeated generations.
 */
async function runResidencyValidation(modelPath?: string): Promise<BenchmarkResult[]> {
  console.log("[NASUKI][BENCHMARK] Starting Residency Validation...");
  const results: BenchmarkResult[] = [];

  const loadResult = await loadModel(modelPath);
  if (!loadResult.success) throw new Error("Load failed");

  for (let i = 1; i <= 3; i++) {
    console.log(`[NASUKI][BENCHMARK] Generation ${i}/3...`);

    const startStats = await DeviceDiagnostics.getProcessStats();
    const bench = await generate(BENCHMARK_PROMPT);
    const endStats = await DeviceDiagnostics.getProcessStats();
    const hardware = await DeviceDiagnostics.getHardwareStatus();

    results.push({
      id: `residency_${i}_${Date.now()}`,
      type: "residency_validation",
      timestamp: Date.now(),
      config: { threads: currentAdaptiveThreads || 4, context: currentAdaptiveContext, batch: 512, adaptive: false },
      performance: {
        prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
        decodeTps: bench.metrics.tokensPerSec || 0,
        latencyMs: bench.metrics.generationTimeMs || 0
      },
      hardware,
      samples: [],
      paging: {
        minorFaultDelta: endStats.minorFaults - startStats.minorFaults,
        majorFaultDelta: endStats.majorFaults - startStats.majorFaults
      }
    });
  }

  await releaseModel();
  await saveBenchmarkResults(results);
  return results;
}

/**
 * Measures performance degradation under artificial RAM pressure.
 */
async function runRamPressureExperiment(stepMB: number = 256, maxMB: number = 1024, modelPath?: string): Promise<BenchmarkResult[]> {
  console.log(`[NASUKI][BENCHMARK] Starting RAM Pressure Experiment (Step: ${stepMB}MB, Max: ${maxMB}MB)...`);
  const results: BenchmarkResult[] = [];

  try {
    for (let pressure = 0; pressure <= maxMB; pressure += stepMB) {
      if (pressure > 0) {
        console.log(`[NASUKI][BENCHMARK] Applying ${pressure}MB pressure...`);
        const pResult = await DeviceDiagnostics.allocateMemoryPressure(stepMB); // Incremental
        if (!pResult) break;
      }

      const loadResult = await loadModel(modelPath);
      if (!loadResult.success) break;

      const bench = await generate(BENCHMARK_PROMPT);
      const hardware = await DeviceDiagnostics.getHardwareStatus();

      results.push({
        id: `pressure_${pressure}_${Date.now()}`,
        type: "ram_pressure",
        timestamp: Date.now(),
        config: { threads: currentAdaptiveThreads || 4, context: currentAdaptiveContext, batch: 512, adaptive: false },
        performance: {
          prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
          decodeTps: bench.metrics.tokensPerSec || 0,
          latencyMs: bench.metrics.generationTimeMs || 0
        },
        hardware,
        samples: []
      });

      await releaseModel();

      if (hardware.lowMemory) {
        console.warn("[NASUKI][BENCHMARK] Low memory detected, aborting pressure experiment.");
        break;
      }
    }
  } finally {
    await DeviceDiagnostics.releaseMemoryPressure();
  }

  await saveBenchmarkResults(results);
  return results;
}

/**
 * Runs a long-duration stress test to compare static vs adaptive.
 */
async function runStressTest(durationSeconds: number, adaptive: boolean, modelPath?: string): Promise<BenchmarkResult> {
  console.log(`[NASUKI][BENCHMARK] Starting ${adaptive ? 'ADAPTIVE' : 'STATIC'} Stress Test (${durationSeconds}s)...`);

  isAdaptiveEnabled = adaptive;

  const loadResult = await loadModel(modelPath);
  if (!loadResult.success) throw new Error("Load failed");

  const samples: DeviceDiagnostics.TelemetrySample[] = [];
  const startTime = Date.now();

  const collector = setInterval(async () => {
    const status = await DeviceDiagnostics.getHardwareStatus();
    samples.push({
      ...status,
      elapsedMs: Date.now() - startTime
    });
  }, 2000);

  // We need to keep generating. llama.rn's completion might finish early if n_predict is small.
  // We'll use a very large n_predict or loop.
  const result = await generate("Write an extremely detailed history of the world from the Big Bang to the present day. Be as verbose as possible.", undefined);

  clearInterval(collector);
  const health = DeviceDiagnostics.summarizeRunHealth(samples);

  const report: BenchmarkResult = {
    id: `stress_${adaptive ? 'adaptive' : 'static'}_${Date.now()}`,
    type: "stress_test",
    timestamp: Date.now(),
    config: {
        threads: currentAdaptiveThreads || 4,
        context: currentAdaptiveContext,
        batch: 512,
        adaptive
    },
    performance: {
      prefillTps: result.metrics.promptTokens ? result.metrics.promptTokens / (result.metrics.firstTokenTimeMs! / 1000) : 0,
      decodeTps: result.metrics.tokensPerSec || 0,
      latencyMs: result.metrics.generationTimeMs || 0,
      totalTokens: result.metrics.tokenCount
    },
    hardware: samples[samples.length - 1],
    samples: samples,
    health
  };

  await releaseModel();
  isAdaptiveEnabled = true; // Restore default
  return report;
}

async function runFinalStressTest(modelPath?: string): Promise<BenchmarkResult[]> {
  console.log("[NASUKI][BENCHMARK] STARTING FINAL A/B STRESS TEST");

  // 1. Static Run (Control)
  const staticResult = await runStressTest(300, false, modelPath); // 5 minutes
  await waitForCooldown();

  // 2. Adaptive Run (Experimental)
  const adaptiveResult = await runStressTest(300, true, modelPath); // 5 minutes

  const results = [staticResult, adaptiveResult];
  await saveBenchmarkResults(results);
  return results;
}

// ============================================================
// CALIBRATION BENCHMARK
// ============================================================

/**
 * Runs a "Nasuki Sweep" to find the optimal thread count for the device.
 * Tests 1 to availableProcessors and identifies the knee of the curve.
 */
async function calibrateThreads(modelPath?: string): Promise<DeviceProfile> {
  console.log("[NASUKI][BENCHMARK] STARTING CALIBRATION SWEEP...");

  const cpuInfo = await DeviceDiagnostics.getCpuInfo();
  const memInfo = await DeviceDiagnostics.getMemoryInfo();
  const maxThreads = cpuInfo.availableProcessors || 4;

  const results: Array<{ threads: number; tps: number; headroom: number }> = [];
  let bestTps = 0;
  let optimalThreads = 1;

  for (let t = 1; t <= maxThreads; t++) {
    try {
      console.log(`[NASUKI][BENCHMARK] Testing ${t} threads...`);

      const loadResult = await loadModel(modelPath, undefined, t);
      if (!loadResult.success) continue;

      const benchResult = await generate("Explain quantum physics in one sentence.", undefined);
      const tps = benchResult.metrics.tokensPerSec || 0;
      const status = await DeviceDiagnostics.getHardwareStatus();

      results.push({ threads: t, tps, headroom: status.thermalHeadroom });

      console.log(`[NASUKI][BENCHMARK] ${t} threads: ${tps.toFixed(2)} tok/sec (Headroom: ${status.thermalHeadroom.toFixed(2)})`);

      // Knee Detection: If improvement is less than 5% over previous best, we've hit the limit.
      if (t > 1 && tps < bestTps * 1.05) {
        console.log(`[NASUKI][BENCHMARK] Knee detected at ${t-1} threads.`);
        optimalThreads = t - 1;
        break;
      }

      if (tps > bestTps) {
        bestTps = tps;
        optimalThreads = t;
      }

      // Safety: If thermal headroom is getting too low, stop sweep
      if (status.thermalHeadroom > 0.8) {
        console.log(`[NASUKI][BENCHMARK] Thermal limit reached. Stopping sweep.`);
        break;
      }

      await releaseModel();
    } catch (e) {
      console.error(`[NASUKI][BENCHMARK] Error testing ${t} threads:`, e);
      break;
    }
  }

  const profile: DeviceProfile = {
    optimalThreads,
    maxThreads,
    benchmarkDate: Date.now(),
    avgTokensPerSec: bestTps,
    ramGb: Math.round(memInfo.totalRamMB / 1024)
  };

  await saveDeviceProfile(profile);
  console.log("[NASUKI][BENCHMARK] CALIBRATION COMPLETE:", profile);
  return profile;
}

async function saveDeviceProfile(profile: DeviceProfile) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DEVICE_PROFILE, JSON.stringify(profile));
    cachedProfile = profile;
  } catch (e) {
    console.error("Failed to save device profile", e);
  }
}

async function getOptimalConfig() {
  const status = await DeviceDiagnostics.getHardwareStatus();

  let threads = MODEL_THREADS;
  let context = MODEL_CONTEXT_SIZE;

  if (cachedProfile) {
    threads = cachedProfile.optimalThreads;
  } else {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_PROFILE);
      if (stored) {
        cachedProfile = JSON.parse(stored);
        threads = cachedProfile!.optimalThreads;
      }
    } catch {}
  }

  // Memory Safety Safeguard
  if (status.availableRamMB < 500 || status.lowMemory) {
     console.warn("[NASUKI][ADAPTIVE] Low memory detected, reducing initial context.");
     context = Math.min(context, 1024);
     threads = Math.max(1, threads - 1);
  }

  return { threads, context };
}

// ============================================================
// EXPORT
// ============================================================

async function runContextSweep(sizes: number[] = [512, 1024, 2048, 4096], modelPath?: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const size of sizes) {
    console.log(`[NASUKI][BENCHMARK] Context Sweep: Testing ${size} tokens...`);
    currentAdaptiveContext = size;

    const loadResult = await loadModel(modelPath);
    if (!loadResult.success) break;

    const bench = await generate(BENCHMARK_PROMPT);
    const endStatus = await DeviceDiagnostics.getHardwareStatus();

    results.push({
      id: `ctx_${size}_${Date.now()}`,
      type: "context_sweep",
      timestamp: Date.now(),
      config: { threads: currentAdaptiveThreads || 4, context: size, batch: 512, adaptive: false },
      performance: {
        prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
        decodeTps: bench.metrics.tokensPerSec || 0,
        latencyMs: bench.metrics.generationTimeMs || 0
      },
      hardware: endStatus,
      samples: []
    });

    await releaseModel();
    await waitForCooldown();
  }

  await saveBenchmarkResults(results);
  return results;
}

/**
 * Compares performance with ADPF ON vs OFF.
 */
async function runAdpfComparison(modelPath?: string): Promise<BenchmarkResult[]> {
  console.log("[NASUKI][BENCHMARK] Starting ADPF Comparison...");
  const results: BenchmarkResult[] = [];

  for (const enabled of [false, true]) {
    console.log(`[NASUKI][BENCHMARK] Testing ADPF ${enabled ? 'ON' : 'OFF'}...`);
    benchmarkAdpfEnabled = enabled;

    const loadResult = await loadModel(modelPath);
    if (!loadResult.success) break;

    const bench = await generate(BENCHMARK_PROMPT);
    const hardware = await DeviceDiagnostics.getHardwareStatus();

    results.push({
      id: `adpf_${enabled}_${Date.now()}`,
      type: "sustained_burn", // Reusing type or creating new one
      timestamp: Date.now(),
      config: { threads: currentAdaptiveThreads || 4, context: currentAdaptiveContext, batch: 512, adaptive: false },
      performance: {
        prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
        decodeTps: bench.metrics.tokensPerSec || 0,
        latencyMs: bench.metrics.generationTimeMs || 0
      },
      hardware,
      samples: [],
      adpf: {
        enabled,
        workerCount: enabled ? (await activeContext.getWorkerTids()).length : 0,
        targetDurationNanos: 100 * 1000000,
        actualDurationNanos: (bench.metrics.generationTimeMs! / bench.metrics.tokenCount!) * 1000000
      }
    });

    await releaseModel();
    await waitForCooldown();
  }

  benchmarkAdpfEnabled = true; // Reset
  await saveBenchmarkResults(results);
  return results;
}

/**
 * Sweeps GPU layers to find the optimal offload count.
 */
async function runGpuProfilingSweep(modelPath?: string): Promise<BenchmarkResult[]> {
  console.log("[NASUKI][BENCHMARK] Starting GPU Profiling Sweep...");
  const results: BenchmarkResult[] = [];

  const llamaModule = require("llama.rn");
  const devices = await llamaModule.getBackendDevicesInfo();
  const gpuDevice = devices.find((d: any) => d.type === "gpu");

  if (!gpuDevice) {
    console.warn("[NASUKI][BENCHMARK] No GPU backend detected, skipping sweep.");
    return [];
  }

  const layerSteps = [0, 8, 16, 24, 32]; // Gemma 2B has ~26 layers, but we test beyond

  for (const layers of layerSteps) {
    console.log(`[NASUKI][BENCHMARK] GPU Sweep: Testing ${layers} layers...`);

    const loadResult = await loadModel(modelPath, undefined, undefined, layers);
    if (!loadResult.success) continue;

    const bench = await generate(BENCHMARK_PROMPT);
    const hardware = await DeviceDiagnostics.getHardwareStatus();

    results.push({
      id: `gpu_${layers}_${Date.now()}`,
      type: "thread_sweep",
      timestamp: Date.now(),
      config: { threads: currentAdaptiveThreads || 4, context: currentAdaptiveContext, batch: 512, adaptive: false },
      performance: {
        prefillTps: bench.metrics.promptTokens ? bench.metrics.promptTokens / (bench.metrics.firstTokenTimeMs! / 1000) : 0,
        decodeTps: bench.metrics.tokensPerSec || 0,
        latencyMs: bench.metrics.generationTimeMs || 0
      },
      hardware,
      samples: [],
      gpu: {
        backend: gpuDevice.backend,
        device: gpuDevice.deviceName,
        nGpuLayers: layers
      }
    });

    await releaseModel();
    await waitForCooldown();
  }

  await saveBenchmarkResults(results);
  return results;
}

export const LocalInferencePOC = {
  getStatus:
    () => currentStatus,

  getQualityLevel:
    () => currentQualityLevel,

  getLastDecision:
    () => governor.getLastDecision(),

  getModelPath:
    () => currentModelPath,

  getModelDirectory,

  getDefaultModelPath,

  importModel,

  checkModelFile,

  loadModel,

  calibrateThreads,

  runThreadSweep,

  runContextSweep,

  runSustainedBurn,

  runResidencyValidation,

  runRamPressureExperiment,

  runAdpfComparison,

  runGpuProfilingSweep,

  runFinalStressTest,

  getOptimalConfig,

  generate,

  stopGeneration,

  releaseModel,

  async runExperimentSuite(modelPath?: string) {
    console.log("[NASUKI][BENCHMARK] STARTING FULL EXPERIMENT SUITE");
    const threadResults = await runThreadSweep(modelPath);
    const contextResults = await runContextSweep([512, 1024, 2048], modelPath);
    const residencyResults = await runResidencyValidation(modelPath);
    const pressureResults = await runRamPressureExperiment(256, 1024, modelPath);
    const adpfResults = await runAdpfComparison(modelPath);
    const gpuResults = await runGpuProfilingSweep(modelPath);
    const stressResults = await runFinalStressTest(modelPath);
    const burnResult = await runSustainedBurn(60, modelPath);

    return {
      threadResults,
      contextResults,
      residencyResults,
      pressureResults,
      adpfResults,
      gpuResults,
      stressResults,
      burnResult
    };
  }
};