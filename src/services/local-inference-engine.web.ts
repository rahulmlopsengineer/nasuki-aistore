import {
  LocalInferenceEngine,
  ModelStatus,
  LoadModelOptions,
  GenerationOptions,
  GenerationResult,
  WebCapabilities
} from "./local-inference/types";
import { detectWebCapabilities } from "./local-inference/web/web-capabilities";
import { WebModelStorage } from "./local-inference/web/web-model-storage";

// Dynamically import transformers to avoid breaking environments where it's not supported
let transformers: any = null;

class WebInferenceEngine implements LocalInferenceEngine {
  private status: ModelStatus = "IDLE";
  private model: any = null;
  private tokenizer: any = null;
  private loadPromise: Promise<any> | null = null;
  private abortController: AbortController | null = null;

  getStatus(): ModelStatus {
    return this.status;
  }

  isModelLoaded(): boolean {
    return this.model !== null && this.status === "READY";
  }

  async checkModelAvailable(options: { modelId: string, filename: string }): Promise<{ exists: boolean; sizeBytes?: number }> {
    const isStored = await WebModelStorage.isModelStored(options.filename);
    if (!isStored) return { exists: false };

    const file = await WebModelStorage.getModelFile(options.filename);
    return {
      exists: true,
      sizeBytes: file?.size
    };
  }

  async getWebCapabilities(): Promise<WebCapabilities> {
    return detectWebCapabilities();
  }

  private async downloadModel(options: LoadModelOptions): Promise<string> {
    const isStored = await WebModelStorage.isModelStored(options.filename);
    if (isStored) {
      console.log("[NASUKI][WEB] Model found in OPFS.");
      this.status = "VERIFYING";
      const file = await WebModelStorage.getModelFile(options.filename);
      if (file) {
          this.status = "MODEL_AVAILABLE";
          return URL.createObjectURL(file);
      }
    }

    this.status = "DOWNLOADING";
    console.log("[NASUKI][WEB] Model not found locally. Starting download...");

    // Construct the URL - assuming GGUF is on HF
    const repoId = options.modelId.includes('/') ? options.modelId : `google/${options.modelId}`;
    const modelUrl = `https://huggingface.co/${repoId}/resolve/main/${options.filename}`;

    try {
        const response = await fetch(modelUrl);
        if (!response.ok) throw new Error("MODEL_DOWNLOAD_FAILED");

        const totalSize = parseInt(response.headers.get("content-length") || "0", 10);
        if (totalSize === 0) throw new Error("MODEL_DOWNLOAD_FAILED: Empty response");

        const body = response.body;
        if (!body) throw new Error("MODEL_DOWNLOAD_FAILED: No body");

        await WebModelStorage.saveModel(options.filename, body, options.onProgress, totalSize);

        this.status = "VERIFYING";
        const file = await WebModelStorage.getModelFile(options.filename);
        if (!file) throw new Error("MODEL_LOAD_FAILED");

        this.status = "MODEL_AVAILABLE";
        return URL.createObjectURL(file);
    } catch (e: any) {
        console.error("[NASUKI][WEB] Download failed:", e);
        throw e;
    }
  }

  async loadModel(options: LoadModelOptions): Promise<{ success: boolean; error?: string }> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        // 1. Feature detection
        const caps = await detectWebCapabilities();
        if (!caps.wasm) throw new Error("WASM_UNAVAILABLE");

        // 2. Download/Retrieve from OPFS
        const blobUrl = await this.downloadModel(options);

        // 3. Load Transformers.js
        this.status = "LOADING";
        if (!transformers) {
          console.log("[NASUKI][WEB] Importing Transformers.js...");
          // @ts-ignore
          const { env, AutoTokenizer, AutoModelForCausalLM } = await import("@huggingface/transformers");
          transformers = { env, AutoTokenizer, AutoModelForCausalLM };

          transformers.env.allowLocalModels = true;
          transformers.env.useBrowserCache = false; // We manage our own storage via OPFS
        }

        // 4. Initialize model
        console.log("[NASUKI][WEB] Initializing inference engine (this may take time)...");

        const transformersOptions = {
          progress_callback: (progress: any) => {
            if (progress.status === "progress") {
                // This could be post-download processing
            }
          },
          device: caps.webGPU ? "webgpu" : "wasm",
          // @ts-ignore - GGUF specific options in v3
          gguf: true,
        };

        this.tokenizer = await transformers.AutoTokenizer.from_pretrained(options.modelId);

        // Load the model from the local blob URL
        this.model = await transformers.AutoModelForCausalLM.from_pretrained(blobUrl, transformersOptions);

        // 5. Warmup
        this.status = "WARMING_UP";
        await this.warmup();

        this.status = "READY";
        console.log(`[NASUKI][WEB] Model ready on ${caps.webGPU ? 'WebGPU' : 'WASM'}`);
        return { success: true };
      } catch (e: any) {
        console.error("[NASUKI][WEB] Model load failed:", e);
        this.status = "FAILED";
        this.loadPromise = null;
        return { success: false, error: e.message };
      }
    })();

    return this.loadPromise;
  }

  private async warmup() {
    console.log("[NASUKI][WEB] Warming up engine...");
    await this.generate("Hi", { maxTokens: 2 });
  }

  async unloadModel(): Promise<void> {
    this.status = "UNLOADING";
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    this.tokenizer = null;
    this.status = "IDLE";
    this.loadPromise = null;
  }

  async generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult> {
    if (!this.model || !this.tokenizer) throw new Error("Model not loaded");

    const previousStatus = this.status;
    this.status = "GENERATING";
    this.abortController = new AbortController();

    const startTime = Date.now();
    let firstTokenTimeMs: number | null = null;
    let tokenCount = 0;

    try {
      const { input_ids } = this.tokenizer(prompt);

      const streamer = {
        put: (tokens: any) => {
          if (firstTokenTimeMs === null) {
            firstTokenTimeMs = Date.now() - startTime;
          }
          tokenCount += tokens.length;
          const decoded = this.tokenizer.decode(tokens, { skip_special_tokens: true });
          options?.onToken?.(decoded);
        },
        end: () => {}
      };

      const output = await this.model.generate({
        input_ids,
        max_new_tokens: options?.maxTokens || 256,
        do_sample: true,
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 0.9,
        // @ts-ignore
        streamer,
        signal: this.abortController.signal
      });

      const fullText = this.tokenizer.decode(output[0], { skip_special_tokens: true });
      const endTime = Date.now();

      this.status = previousStatus === "WARMING_UP" ? "READY" : "READY";
      return {
        text: fullText.replace(prompt, "").trim(),
        metrics: {
          generationTimeMs: endTime - startTime,
          firstTokenLatencyMs: firstTokenTimeMs ?? undefined,
          tokenCount: tokenCount,
          tokensPerSec: tokenCount / ((endTime - startTime) / 1000)
        }
      };
    } catch (e: any) {
      if (e.name === "AbortError") {
        this.status = "READY";
        return { text: "", metrics: {}, errorCode: "MODEL_ABORTED" };
      }
      this.status = "ERROR";
      return { text: "", metrics: {}, error: e.message, errorCode: "GENERATION_ERROR" };
    } finally {
      this.abortController = null;
    }
  }

  async stopGeneration(): Promise<void> {
    if (this.abortController) {
      this.status = "ABORTING";
      this.abortController.abort();
    }
  }
}

export const engine = new WebInferenceEngine();
