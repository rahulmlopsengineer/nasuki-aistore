// OnboardingService — interface + minimal local-storage persistence.

import { STORAGE_KEYS } from "@/src/constants/config";
import { storage } from "@/src/utils/storage";

export const OnboardingService = {
  async isComplete(): Promise<boolean> {
    return (await storage.getItem<boolean>(STORAGE_KEYS.onboardingComplete, false)) ?? false;
  },
  async complete(): Promise<void> {
    await storage.setItem(STORAGE_KEYS.onboardingComplete, true);
  },
  async reset(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.onboardingComplete);
  },
};
