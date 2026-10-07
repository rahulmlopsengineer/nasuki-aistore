import { Platform } from "react-native";
import { engine } from "../local-inference-engine.android";
import * as DeviceDiagnostics from "../DeviceDiagnostics";
import { DEFAULT_MODEL_ID, SUPPORTED_MODELS } from "./model-config";

export interface BenchmarkConfig {
  threads: number;
  gpuLayers: number;
  context: number;
}

export interface BenchmarkRunResult {
  config: BenchmarkConfig;
  loadMs: number;
  warmupMs: number;
  ttftMs: number;
  tokens: number;
  tokensPerSecond: number;
  peakPssMB: number;
  peakRssMB: number;
  availableRamMB: number;
  thermalStatus: number;
  stable: boolean;
  error?: string;
}

const BENCHMARK_PROMPT = "Explain machine learning in three short sentences.";

export const BenchmarkRunner = {
  async runSingle(config: BenchmarkConfig, modelFilename: string): Promise<BenchmarkRunResult> {
    if (Platform.OS !== "android") {
      throw new Error("Benchmarks are supported on Android target only.");
    }

    const initialStatus = await DeviceDiagnostics.getHardwareStatus();
    let loadMs = 0;
    let warmupMs = 0;
    let ttftMs = 0;
    let tokens = 0;
    let tokensPerSecond = 0;
    let peakPssMB = initialStatus.appPssMB;
    let peakRssMB = (initialStatus.rssKb || 0) / 1024;
    let stable = true;
    let error: string | undefined;

    const loadStart = Date.now();
    const loadResult = await engine.loadModel({
      modelId: DEFAULT_MODEL_ID,
      filename: modelFilename,
      contextSize: config.context,
      threads: config.threads,
      gpuLayers: config.gpuLayers,
    });
    loadMs = Date.now() - loadStart;

    if (!loadResult.success) {
      return {
        config,
        loadMs,
        warmupMs: 0,
        ttftMs: 0,
        tokens: 0,
        tokensPerSecond: 0,
        peakPssMB,
        peakRssMB,
        availableRamMB: initialStatus.availableRamMB,
        thermalStatus: initialStatus.thermalStatus,
        stable: false,
        error: loadResult.error || "Load failed",
      };
    }

    // Run benchmark generation
    const genStart = Date.now();
    const genResult = await engine.generate(BENCHMARK_PROMPT, { maxTokens: 32 });

    if (genResult.error) {
      stable = false;
      error = genResult.error;
    } else {
      ttftMs = genResult.metrics.firstTokenLatencyMs || 0;
      tokens = genResult.metrics.tokenCount || 0;
      tokensPerSecond = genResult.metrics.tokensPerSec || 0;
    }

    const postStatus = await DeviceDiagnostics.getHardwareStatus();
    peakPssMB = Math.max(peakPssMB, postStatus.appPssMB);
    peakRssMB = Math.max(peakRssMB, (postStatus.rssKb || 0) / 1024);

    // Unload model cleanly after test
    await engine.unloadModel();

    return {
      config,
      loadMs,
      warmupMs: 0, // embedded in load/generation
      ttftMs,
      tokens,
      tokensPerSecond,
      peakPssMB,
      peakRssMB,
      availableRamMB: postStatus.availableRamMB,
      thermalStatus: postStatus.thermalStatus,
      stable,
      error,
    };
  },

  async runMatrix(modelFilename: string): Promise<BenchmarkRunResult[]> {
    const testConfigs: BenchmarkConfig[] = [
      // CPU thread sweep (baseline gpu=2, ctx=200)
      { threads: 1, gpuLayers: 2, context: 200 },
      { threads: 2, gpuLayers: 2, context: 200 },
      { threads: 3, gpuLayers: 2, context: 200 },
      { threads: 4, gpuLayers: 2, context: 200 },
      { threads: 5, gpuLayers: 2, context: 200 },
      { threads: 6, gpuLayers: 2, context: 200 },

      // GPU layer sweep (baseline threads=3, ctx=200)
      { threads: 3, gpuLayers: 0, context: 200 },
      { threads: 3, gpuLayers: 1, context: 200 },
      { threads: 3, gpuLayers: 4, context: 200 },
      { threads: 3, gpuLayers: 6, context: 200 },

      // Context size sweep (baseline threads=3, gpu=2)
      { threads: 3, gpuLayers: 2, context: 128 },
      { threads: 3, gpuLayers: 2, context: 256 },
      { threads: 3, gpuLayers: 2, context: 384 },
      { threads: 3, gpuLayers: 2, context: 512 },
    ];

    const results: BenchmarkRunResult[] = [];
    for (const cfg of testConfigs) {
      console.log(`[NASUKI][BENCHMARK] Running config: threads=${cfg.threads}, gpu=${cfg.gpuLayers}, ctx=${cfg.context}`);
      try {
        const res = await BenchmarkRunner.runSingle(cfg, modelFilename);
        results.push(res);
      } catch (e: any) {
        results.push({
          config: cfg,
          loadMs: 0,
          warmupMs: 0,
          ttftMs: 0,
          tokens: 0,
          tokensPerSecond: 0,
          peakPssMB: 0,
          peakRssMB: 0,
          availableRamMB: 0,
          thermalStatus: 0,
          stable: false,
          error: e.message,
        });
      }
    }
    return results;
  }
};
