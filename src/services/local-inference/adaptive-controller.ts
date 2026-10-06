import * as DeviceDiagnostics from "../DeviceDiagnostics";

export interface InferenceProfile {
  name: "LOW_MEMORY" | "BALANCED" | "PERFORMANCE";
  context: number;
  threads: number;
  gpuLayers: number;
  use_mmap: boolean;
  use_mlock: boolean;
}

export const VALIDATED_PROFILES: Record<string, InferenceProfile> = {
  LOW_MEMORY: {
    name: "LOW_MEMORY",
    context: 128,
    threads: 2,
    gpuLayers: 1,
    use_mmap: true,
    use_mlock: false,
  },
  BALANCED: {
    name: "BALANCED",
    context: 200,
    threads: 3,
    gpuLayers: 2,
    use_mmap: true,
    use_mlock: false,
  },
  PERFORMANCE: {
    name: "PERFORMANCE",
    context: 200,
    threads: 4,
    gpuLayers: 4,
    use_mmap: true,
    use_mlock: false,
  },
};

export const AdaptiveController = {
  async selectProfile(): Promise<InferenceProfile> {
    const hw = await DeviceDiagnostics.getHardwareStatus();
    const availableMB = hw.availableRamMB;
    const thermalStatus = hw.thermalStatus;
    const thermalHeadroom = hw.thermalHeadroom;
    const headroomStatus = hw.thermalHeadroomStatus;

    console.log(`[NASUKI][ANDROID][ADAPTIVE] Device Telemetry:\nAvailable RAM: ${availableMB.toFixed(1)}MB\nThermal Status: ${thermalStatus}\nThermal Headroom: ${thermalHeadroom} (${headroomStatus})\nGPU Telemetry: UNAVAILABLE`);

    let selectedName: "LOW_MEMORY" | "BALANCED" | "PERFORMANCE" = "BALANCED";
    let reason = "";

    if (availableMB < 180) {
      throw new Error(`ABORT: Available RAM (${availableMB.toFixed(1)}MB) is below the 180MB safety threshold.`);
    } else if (availableMB < 400) {
      selectedName = "LOW_MEMORY";
      reason = `Available RAM (${availableMB.toFixed(1)}MB) is in high pressure / critical range (<400MB).`;
    } else if (availableMB < 700) {
      selectedName = "LOW_MEMORY";
      reason = `Available RAM (${availableMB.toFixed(1)}MB) is in caution range (400-699MB).`;
    } else if (availableMB < 1200) {
      selectedName = "BALANCED";
      reason = `Available RAM (${availableMB.toFixed(1)}MB) is in safe range (700-1199MB).`;
    } else {
      // >= 1200 MB
      if (thermalStatus >= 2 || (headroomStatus === "VALID" && thermalHeadroom < 0.3)) {
        selectedName = "BALANCED";
        reason = `Available RAM is high (${availableMB.toFixed(1)}MB), but thermal condition is elevated (status=${thermalStatus}, headroom=${thermalHeadroom}), falling back to BALANCED.`;
      } else {
        selectedName = "PERFORMANCE";
        reason = `Available RAM is high (${availableMB.toFixed(1)}MB) and thermal state is normal.`;
      }
    }

    console.log(`[NASUKI][ANDROID][ADAPTIVE] Selected profile: ${selectedName}\nReason: ${reason}`);
    const profile = VALIDATED_PROFILES[selectedName];
    console.log(`[NASUKI][ANDROID][ADAPTIVE] Config:\nn_ctx=${profile.context}\nn_threads=${profile.threads}\nn_gpu_layers=${profile.gpuLayers}`);

    return profile;
  },

  getNextFallbackProfile(currentName: string, attempted: Set<string>): InferenceProfile | null {
    const fallbackOrder = ["PERFORMANCE", "BALANCED", "LOW_MEMORY"];
    attempted.add(currentName);

    for (const name of fallbackOrder) {
      if (!attempted.has(name)) {
        console.warn(`[NASUKI][ANDROID][ADAPTIVE] Falling back from ${currentName} to ${name}`);
        return VALIDATED_PROFILES[name];
      }
    }
    return null;
  }
};
