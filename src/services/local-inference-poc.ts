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
import { initLlama } from "llama.rn";

// ============================================================
// TYPES
// ============================================================

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

// Conservative settings for 4–6 GB Android devices.
const MODEL_CONTEXT_SIZE = 200;
const MODEL_THREADS = 3;
const MODEL_GPU_LAYERS = 2;

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
      "[NASUKI][MODEL] Source size:",
      sourceInfo.size
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
      copied.size
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
      copied.size !== asset.size
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
      info.size
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
          ? info.size
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
  onProgress?: (progress: number) => void
) {
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

    const config = {
      model: nativeModelPath,

      n_ctx:
        MODEL_CONTEXT_SIZE,

      n_threads:
        MODEL_THREADS,

      n_gpu_layers:
        MODEL_GPU_LAYERS,

      use_mmap: true,

      use_mlock: false,
    };

    console.log(
      "[NASUKI][LLAMA] Runtime config:",
      config
    );

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
// EXPORT
// ============================================================

export const LocalInferencePOC = {
  getStatus:
    () => currentStatus,

  getModelPath:
    () => currentModelPath,

  getModelDirectory,

  getDefaultModelPath,

  importModel,

  checkModelFile,

  loadModel,

  generate,

  stopGeneration,

  releaseModel,
};