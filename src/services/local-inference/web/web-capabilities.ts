import { WebCapabilities } from "../types";

export async function detectWebCapabilities(): Promise<WebCapabilities> {
  const webGPU = typeof navigator !== "undefined" && "gpu" in navigator;

  // Check for WASM support
  const wasm = typeof WebAssembly !== "undefined";

  // Check for SharedArrayBuffer (required for multi-threaded WASM)
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";

  // Check for cross-origin isolation (required for SharedArrayBuffer)
  const crossOriginIsolated = typeof window !== "undefined" && window.crossOriginIsolated;

  // Check for storage availability (OPFS/IndexedDB)
  let storage = false;
  try {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.getDirectory === "function") {
      storage = true; // OPFS supported
    } else if (typeof indexedDB !== "undefined") {
      storage = true; // IndexedDB fallback
    }
  } catch (e) {
    storage = false;
  }

  // Estimate device memory
  let estimatedDeviceMemoryGB: number | undefined;
  if (typeof navigator !== "undefined" && (navigator as any).deviceMemory) {
    estimatedDeviceMemoryGB = (navigator as any).deviceMemory;
  }

  return {
    webGPU,
    wasm,
    sharedArrayBuffer,
    crossOriginIsolated,
    storage,
    estimatedDeviceMemoryGB
  };
}
