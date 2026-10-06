import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export interface ModelDefinition {
  id: string;
  filename: string;
  sizeBytes: number;
  format: "gguf" | "onnx" | "safetensors";
  contextSize: number;
}

export const SUPPORTED_MODELS: Record<string, ModelDefinition> = {
  "gemma-2-2b-it-q4": {
    id: "google/gemma-2-2b-it", // Use repo id for transformers.js
    filename: "gemma-2-2b-it-Q4_K_M.gguf",
    sizeBytes: 1708582752,
    format: "gguf",
    contextSize: 200
  }
};

export const DEFAULT_MODEL_ID = "gemma-2-2b-it-q4";

export function getModelPath(filename: string = "gemma-2-2b-it-Q4_K_M.gguf"): string {
  if (Platform.OS === "web") return filename;
  return `${FileSystem.documentDirectory}models/${filename}`;
}
