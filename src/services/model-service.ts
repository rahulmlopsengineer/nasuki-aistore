// ModelService — mock model catalog + install state.
// Phase 3 wires this to a real Model Manager (download / verify / delete).

import { mockInstalledModels, mockModels } from "@/src/constants/mock-data";
import { AIModel, InstalledModel } from "@/src/types";
import { delay, nowIso } from "@/src/utils/misc";

let installed: InstalledModel[] = [...mockInstalledModels];

const find = (id: string): InstalledModel =>
  installed.find((m) => m.modelId === id) ?? {
    modelId: id,
    status: "not_installed",
    progress: 0,
  };

export const ModelService = {
  async listModels(): Promise<AIModel[]> {
    await delay(400);
    return mockModels;
  },

  async getModel(id: string): Promise<AIModel | undefined> {
    await delay(200);
    return mockModels.find((m) => m.id === id);
  },

  async getInstallState(id: string): Promise<InstalledModel> {
    return find(id);
  },

  async listInstallStates(): Promise<InstalledModel[]> {
    return installed;
  },

  // Mock download: emits progress via callback, resolves when installed.
  async download(
    id: string,
    onProgress?: (p: number) => void,
  ): Promise<InstalledModel> {
    installed = installed.map((m) =>
      m.modelId === id ? { ...m, status: "downloading", progress: 0 } : m,
    );
    for (let p = 0.08; p < 1; p += 0.12) {
      await delay(280);
      onProgress?.(Math.min(p, 0.99));
    }
    const done: InstalledModel = {
      modelId: id,
      status: "installed",
      progress: 1,
      installedAt: nowIso(),
    };
    installed = installed.some((m) => m.modelId === id)
      ? installed.map((m) => (m.modelId === id ? done : m))
      : [...installed, done];
    onProgress?.(1);
    return done;
  },

  async remove(id: string): Promise<void> {
    await delay(200);
    installed = installed.map((m) =>
      m.modelId === id ? { ...m, status: "not_installed", progress: 0 } : m,
    );
  },
};
