# Phase 5.1 — Web Local AI Implementation

Implement local AI model loading and inference for the web platform using Transformers.js (v3) while maintaining compatibility with the existing Android implementation.

## Proposed Changes

### Core Interface (`src/services/local-inference/`)
- **[NEW] [types.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference/types.ts)**: Define common interfaces for `LocalInferenceEngine`, `ModelStatus`, and `WebCapabilities`.
- **[NEW] [model-config.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference/model-config.ts)**: Shared model definitions and baseline configurations.
- **[NEW] [index.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference/index.ts)**: Platform-agnostic entry point.

### Platform Adapters (`src/services/`)
- **[NEW] [local-inference.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference.ts)**: Top-level service that selects the platform engine.
- **[NEW] [local-inference-engine.android.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference-engine.android.ts)**: Adapter for existing `llama.rn` logic.
- **[NEW] [local-inference-engine.web.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference-engine.web.ts)**: New web-specific engine using `@huggingface/transformers`.

### Web Implementation Details (`src/services/local-inference/web/`)
- **[NEW] [web-capabilities.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference/web/web-capabilities.ts)**: Detect WebGPU, WASM, and device memory.
- **[NEW] [web-model-storage.ts](file:///C:/dev/nasuki2/frontend/src/services/local-inference/web/web-model-storage.ts)**: Handle OPFS (Origin Private File System) for large model storage.

## User Review Required

> [!IMPORTANT]
> The web implementation requires the `@huggingface/transformers` package. I will add it to `package.json` if you approve.
> This package supports GGUF models and WebGPU acceleration in the browser.

## Verification Plan

### Automated Tests (Web)
1. **Startup**: Verify `npx expo start --web` runs without errors.
2. **Capability Check**: Confirm WebGPU/WASM detection works in the browser console.
3. **Download**: Verify model download to OPFS works and shows progress.
4. **Inference**: Test "Hi" warmup and streaming response.

### Manual Verification (Android)
- Confirm that the existing `llama.rn` flow in the Android development client is unaffected by these changes.
