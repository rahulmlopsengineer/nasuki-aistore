import { NativeModules, Platform } from "react-native";

type DeviceDiagnosticsNative = {
  getDeviceInfo(): Promise<DeviceInfo>;
  getMemoryInfo(): Promise<MemoryInfo>;
  getProcessMemory(): Promise<ProcessMemory>;
  getCpuInfo(): Promise<CpuInfo>;
  getThermalStatus(): Promise<ThermalInfo>;
  getHardwareStatus(): Promise<HardwareStatus>;
  getDiagnostics(): Promise<DeviceDiagnostics>;

  isPerformanceHintSupported(): Promise<boolean>;
  startPerformanceSession(tids: number[], targetDurationNanos: number): Promise<boolean>;
  reportActualWorkDuration(actualDurationNanos: number): Promise<void>;
  closePerformanceSession(): Promise<void>;

  registerThermalListener(): Promise<boolean>;
  unregisterThermalListener(): Promise<void>;

  warmupModel(path: string): Promise<boolean>;

  getProcessStats(): Promise<ProcessStats>;
  getSystemMemoryStats(): Promise<SystemMemoryStats>;
  allocateMemoryPressure(amountMB: number): Promise<{ allocatedMB: number }>;
  releaseMemoryPressure(): Promise<void>;

  getDetailedMemorySnapshot(): Promise<DetailedMemorySnapshot>;
  getTopMemoryMappings(limit: number, sortBy: string): Promise<MemoryMapping[]>;
};

export interface ProcessStats {
  minorFaults: number;
  majorFaults: number;
  rssKb: number;
  timestampNs: number;
}

export interface SystemMemoryStats {
  memTotalBytes: number;
  memAvailableBytes: number;
  cachedBytes: number;
  activeFileBytes: number;
  inactiveFileBytes: number;
  swapTotalBytes: number;
  swapFreeBytes: number;
  timestampNs: number;
}

export interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  device: string;
  androidVersion: string;
  androidSdk: number;
  cpuCores: number;
  supportedAbis: string;
}

export interface MemoryInfo {
  totalRamBytes: number;
  availableRamBytes: number;
  usedRamBytes: number;
  totalRamMB: number;
  availableRamMB: number;
  usedRamMB: number;
  usedRamPercent: number;
  lowMemory: boolean;
}

export interface ProcessMemory {
  pssKb: number;
  privateDirtyKb: number;
  privateCleanKb: number;
  pssMB: number;
}

export interface CpuInfo {
  availableProcessors: number;
  abi: string;
  architectures: string;
}

export interface ThermalInfo {
  thermalStatus: number;
  thermalHeadroom: number;
}

export interface HardwareStatus {
  thermalStatus: number;
  thermalHeadroom: number;
  thermalHeadroomStatus: "VALID" | "UNKNOWN" | "UNSUPPORTED" | "ERROR";
  availableRamMB: number;
  totalRamMB: number;
  lowMemory: boolean;
  appPssMB: number;
  rssKb?: number;
  vsizeMB?: number;
  privateDirtyKb?: number;
  privateCleanKb?: number;
  batteryLevel: number;
  isCharging: boolean;
  timestampNanos: number;
  memory: DetailedMemorySnapshot; // Use the canonical structure
}

export interface DetailedMemorySnapshot {
  timestampMonotonicMs: number;
  process: {
    rssBytes: number;
    pssBytes: number;
    rssAnonBytes: number;
    rssFileBytes: number;
    rssShmemBytes: number;
    privateCleanBytes: number;
    privateDirtyBytes: number;
    sharedCleanBytes: number;
    sharedDirtyBytes: number;
    swapBytes: number;
    swapPssBytes: number;
    vmSizePlusBytes: number;
    vmDataBytes: number;
    vmSwapBytes: number;
  };
  gguf: {
    mappingCount: number;
    virtualSizeBytes: number;
    rssBytes: number;
    pssBytes: number;
    privateCleanBytes: number;
    privateDirtyBytes: number;
    sharedCleanBytes: number;
    sharedDirtyBytes: number;
    swapBytes: number;
  };
  faults: {
    minor: number;
    major: number;
  };
  system: {
    memTotalBytes: number;
    memAvailableBytes: number;
    cachedBytes: number;
    activeFileBytes: number;
    inactiveFileBytes: number;
    swapTotalBytes: number;
    swapFreeBytes: number;
    lowMemory: boolean;
    thresholdBytes: number;
  };
  androidDebugMemory: {
    nativeHeapBytes: number;
    javaHeapBytes: number;
    graphicsBytes: number;
    codeBytes: number;
    systemBytes: number;
    totalBytes: number;
  };
  largeAnonymousMappings?: MemoryMapping[];
}

export interface MemoryMapping {
  range: string;
  perms: string;
  sizeBytes: number;
  rssBytes: number;
  pssBytes: number;
  privateDirtyBytes: number;
  privateCleanBytes: number;
  path: string;
  category: string;
}

export interface TelemetrySample extends HardwareStatus {
  elapsedMs: number;
  threadCount?: number;
  decodeTps?: number;
}

export function calculateThermalVelocity(samples: TelemetrySample[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = (last.timestampNanos - first.timestampNanos) / 1e9; // seconds
  if (dt <= 0.1) return 0;

  const velocity = (last.thermalHeadroom - first.thermalHeadroom) / dt;
  return velocity;
}

export function calculateRamVelocity(samples: TelemetrySample[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = (last.timestampNanos - first.timestampNanos) / 1e9; // seconds
  if (dt <= 0.1) return 0;
  return (last.availableRamMB - first.availableRamMB) / dt;
}

export function summarizeRunHealth(samples: TelemetrySample[]) {
  if (samples.length === 0) return { normalPercent: 0, throttledPercent: 0 };
  const throttledSamples = samples.filter(s => s.thermalStatus >= 2 || (s.thermalHeadroomStatus === "VALID" && s.thermalHeadroom > 0.9)).length;
  const throttledPercent = (throttledSamples / samples.length) * 100;
  return {
    normalPercent: 100 - throttledPercent,
    throttledPercent
  };
}

export interface DeviceDiagnostics {
  manufacturer: string;
  model: string;
  androidVersion: string;
  androidSdk: number;

  cpuCores: number;
  architectures: string;

  totalRamMB?: number;
  availableRamMB?: number;
  usedRamMB?: number;
  ramUsagePercent?: number;
  lowMemory?: boolean;

  processPssMB: number;

  thermalStatus?: number;
  thermalStatusName?: string;
}

const Native =
  NativeModules.DeviceDiagnostics as
    | DeviceDiagnosticsNative
    | undefined;

function getNative(): DeviceDiagnosticsNative {
  if (Platform.OS !== "android") {
    throw new Error(
      "DeviceDiagnostics is currently Android-only."
    );
  }

  if (!Native) {
    throw new Error(
      "DeviceDiagnostics native module is not available. Rebuild the Android development build."
    );
  }

  return Native;
}

export async function getDeviceInfo() {
  return getNative().getDeviceInfo();
}

export async function getMemoryInfo() {
  return getNative().getMemoryInfo();
}

export async function getProcessMemory() {
  return getNative().getProcessMemory();
}

export async function getCpuInfo() {
  return getNative().getCpuInfo();
}

export async function getThermalStatus() {
  return getNative().getThermalStatus();
}

export async function getHardwareStatus() {
  return getNative().getHardwareStatus();
}

export async function isPerformanceHintSupported() {
  return getNative().isPerformanceHintSupported();
}

export async function startPerformanceSession(tids: number[], targetDurationNanos: number) {
  return getNative().startPerformanceSession(tids, targetDurationNanos);
}

export async function reportActualWorkDuration(actualDurationNanos: number) {
  return getNative().reportActualWorkDuration(actualDurationNanos);
}

export async function closePerformanceSession() {
  return getNative().closePerformanceSession();
}

export async function registerThermalListener() {
  return getNative().registerThermalListener();
}

export async function unregisterThermalListener() {
  return getNative().unregisterThermalListener();
}

export async function warmupModel(path: string) {
  return getNative().warmupModel(path);
}

export async function getProcessStats() {
  return getNative().getProcessStats();
}

export async function getSystemMemoryStats() {
  return getNative().getSystemMemoryStats();
}

export async function allocateMemoryPressure(amountMB: number) {
  return getNative().allocateMemoryPressure(amountMB);
}

export async function releaseMemoryPressure() {
  return getNative().releaseMemoryPressure();
}

export async function getDiagnostics() {
  return getNative().getDiagnostics();
}

export async function getDetailedMemorySnapshot() {
  return getNative().getDetailedMemorySnapshot();
}

export async function getTopMemoryMappings(limit: number = 20, sortBy: string = "rss") {
  return getNative().getTopMemoryMappings(limit, sortBy);
}
