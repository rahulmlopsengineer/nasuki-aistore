import { Platform } from "react-native";
import {
  LocalInferenceEngine,
  ModelStatus,
  LoadModelOptions,
  GenerationOptions,
  GenerationResult,
  WebCapabilities
} from "./local-inference/types";

// The actual implementation is selected by Metro/Expo resolver
// based on .android.ts / .web.ts extensions.
// @ts-ignore
import { engine as PlatformEngine } from "./local-inference-engine";

export const LocalInference: LocalInferenceEngine = PlatformEngine;

export * from "./local-inference/types";
export * from "./local-inference/model-config";
