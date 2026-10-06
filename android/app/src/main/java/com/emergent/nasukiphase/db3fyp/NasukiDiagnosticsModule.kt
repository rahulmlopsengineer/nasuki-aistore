package com.emergent.nasukiphase.db3fyp

import android.app.ActivityManager
import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PerformanceHintManager
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.RandomAccessFile
import java.nio.channels.FileChannel
import java.util.ArrayList
import java.util.HashMap
import java.util.concurrent.Executor

/**
 * Native module providing hardware diagnostics and performance hints for the NASUKI runtime.
 */
class NasukiDiagnosticsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var performanceSession: Any? = null 
    private var thermalListener: Any? = null 
    private val pressureAllocations = ArrayList<ByteArray>()

    override fun getName(): String = "DeviceDiagnostics"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            if (reactContext.hasActiveCatalystInstance()) {
                val emitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                emitter.emit(eventName, params)
            }
        } catch (e: Exception) {
            try {
                val emitterClass = Class.forName("com.facebook.react.modules.core.DeviceEventManagerModule\$RCTDeviceEventEmitter")
                val getJSModuleMethod = com.facebook.react.bridge.ReactContext::class.java.getMethod("getJSModule", Class::class.java)
                val emitter = getJSModuleMethod.invoke(reactContext, emitterClass)
                if (emitter != null) {
                    val emitMethod = emitter::class.java.getMethod("emit", String::class.java, Object::class.java)
                    emitMethod.invoke(emitter, eventName, params)
                }
            } catch (ex: Exception) {}
        }
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            val result = Arguments.createMap()
            result.putString("manufacturer", Build.MANUFACTURER)
            result.putString("model", Build.MODEL)
            result.putString("brand", Build.BRAND)
            result.putString("androidVersion", Build.VERSION.RELEASE)
            result.putInt("sdkVersion", Build.VERSION.SDK_INT)
            result.putInt("availableProcessors", Runtime.getRuntime().availableProcessors())
            
            val abis = Build.SUPPORTED_ABIS
            var abiString = ""
            if (abis != null) {
                var i = 0
                while (i < abis.size) {
                    abiString += abis[i]
                    if (i < abis.size - 1) abiString += ","
                    i++
                }
            }
            result.putString("supportedAbis", abiString)

            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (activityManager != null) {
                val memoryInfo = ActivityManager.MemoryInfo()
                activityManager.getMemoryInfo(memoryInfo)
                result.putDouble("totalRamMB", bytesToMB(memoryInfo.totalMem))
                result.putDouble("availableRamMB", bytesToMB(memoryInfo.availMem))
                result.putDouble("usedRamMB", bytesToMB(memoryInfo.totalMem - memoryInfo.availMem))
                result.putDouble("ramUsagePercent", calculatePercentage(memoryInfo.totalMem - memoryInfo.availMem, memoryInfo.totalMem))
                result.putBoolean("lowMemory", memoryInfo.lowMemory)
                result.putBoolean("isLowRamDevice", activityManager.isLowRamDevice)
            }

            val appMemory = Debug.MemoryInfo()
            Debug.getMemoryInfo(appMemory)
            result.putDouble("appPssMB", appMemory.totalPss / 1024.0)

            val runtime = Runtime.getRuntime()
            val maxHeap = runtime.maxMemory()
            val usedHeap = runtime.totalMemory() - runtime.freeMemory()
            result.putDouble("maxHeapMB", bytesToMB(maxHeap))
            result.putDouble("usedHeapMB", bytesToMB(usedHeap))
            result.putDouble("heapUsagePercent", calculatePercentage(usedHeap, maxHeap))

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DEVICE_DIAGNOSTICS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getHardwareStatus(promise: Promise) {
        try {
            val result = Arguments.createMap()
            result.putDouble("timestampNanos", SystemClock.elapsedRealtimeNanos().toDouble())

            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (pm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    result.putInt("thermalStatus", pm.currentThermalStatus)
                } else {
                    result.putInt("thermalStatus", -1)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val headroom = pm.getThermalHeadroom(0)
                    if (headroom.isNaN()) {
                        result.putString("thermalHeadroomStatus", "UNKNOWN")
                        result.putDouble("thermalHeadroom", -1.0)
                    } else {
                        result.putString("thermalHeadroomStatus", "VALID")
                        result.putDouble("thermalHeadroom", headroom.toDouble())
                    }
                } else {
                    result.putString("thermalHeadroomStatus", "UNSUPPORTED")
                    result.putDouble("thermalHeadroom", -1.0)
                }
            }

            // Canonical telemetry read
            val rollup = parseSmapsRollup()
            val status = parseProcStatus()
            val memInfo = parseMemInfo()
            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            
            if (activityManager != null) {
                val memoryInfo = ActivityManager.MemoryInfo()
                activityManager.getMemoryInfo(memoryInfo)
                result.putDouble("totalRamMB", memoryInfo.totalMem / (1024.0 * 1024.0))
                result.putBoolean("lowMemory", memoryInfo.lowMemory)
            }

            val pssBytes = rollup["Pss"] ?: 0L
            val rssBytes = rollup["Rss"] ?: (status["VmRSS"] ?: 0L)
            val privateDirtyBytes = rollup["Private_Dirty"] ?: 0L
            val privateCleanBytes = rollup["Private_Clean"] ?: 0L

            result.putDouble("availableRamMB", (memInfo["MemAvailable"] ?: 0L) / (1024.0 * 1024.0))
            result.putDouble("appPssMB", pssBytes / (1024.0 * 1024.0))
            result.putDouble("rssKb", rssBytes / 1024.0)
            result.putInt("privateDirtyKb", (privateDirtyBytes / 1024).toInt())
            result.putInt("privateCleanKb", (privateCleanBytes / 1024).toInt())
            result.putDouble("vsizeMB", (status["VmSize"] ?: 0L) / (1024.0 * 1024.0))

            // Add the full snapshot map without consuming shared components
            result.putMap("memory", getMemorySnapshotInternal())

            val batteryManager = reactContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            if (batteryManager != null) {
                result.putInt("batteryLevel", batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
                result.putBoolean("isCharging", batteryManager.isCharging)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("HARDWARE_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDetailedMemorySnapshot(promise: Promise) {
        try {
            val result = getMemorySnapshotInternal()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SNAPSHOT_ERROR", e.message, e)
        }
    }

    private fun getMemorySnapshotInternal(): WritableMap {
        val result = Arguments.createMap()
        result.putDouble("timestampMonotonicMs", SystemClock.elapsedRealtime().toDouble())

        // 1. Process Memory (smaps_rollup + status)
        val process = Arguments.createMap()
        val rollup = parseSmapsRollup()
        val status = parseProcStatus()
        
        process.putDouble("rssBytes", (rollup["Rss"] ?: (status["VmRSS"] ?: 0L)).toDouble())
        process.putDouble("pssBytes", (rollup["Pss"] ?: 0L).toDouble())
        process.putDouble("rssAnonBytes", (status["RssAnon"] ?: 0L).toDouble())
        process.putDouble("rssFileBytes", (status["RssFile"] ?: 0L).toDouble())
        process.putDouble("rssShmemBytes", (status["RssShmem"] ?: 0L).toDouble())
        process.putDouble("privateCleanBytes", (rollup["Private_Clean"] ?: 0L).toDouble())
        process.putDouble("privateDirtyBytes", (rollup["Private_Dirty"] ?: 0L).toDouble())
        process.putDouble("sharedCleanBytes", (rollup["Shared_Clean"] ?: 0L).toDouble())
        process.putDouble("sharedDirtyBytes", (rollup["Shared_Dirty"] ?: 0L).toDouble())
        process.putDouble("swapBytes", (rollup["Swap"] ?: 0L).toDouble())
        process.putDouble("swapPssBytes", (rollup["SwapPss"] ?: 0L).toDouble())
        process.putDouble("vmSizePlusBytes", (status["VmSize"] ?: 0L).toDouble())
        process.putDouble("vmDataBytes", (status["VmData"] ?: 0L).toDouble())
        process.putDouble("vmSwapBytes", (status["VmSwap"] ?: 0L).toDouble())
        result.putMap("process", process)

        // 2. GGUF Detection
        val gguf = parseMappings(onlyGguf = true)
        result.putMap("gguf", gguf)

        // 3. Page Faults
        val faults = parsePageFaults()
        result.putMap("faults", faults)

        // 4. System Memory
        val system = Arguments.createMap()
        val memInfo = parseMemInfo()
        system.putDouble("memTotalBytes", (memInfo["MemTotal"] ?: 0L).toDouble())
        system.putDouble("memAvailableBytes", (memInfo["MemAvailable"] ?: 0L).toDouble())
        system.putDouble("cachedBytes", (memInfo["Cached"] ?: 0L).toDouble())
        system.putDouble("activeFileBytes", (memInfo["Active(file)"] ?: 0L).toDouble())
        system.putDouble("inactiveFileBytes", (memInfo["Inactive(file)"] ?: 0L).toDouble())
        system.putDouble("swapTotalBytes", (memInfo["SwapTotal"] ?: 0L).toDouble())
        system.putDouble("swapFreeBytes", (memInfo["SwapFree"] ?: 0L).toDouble())
        
        val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        if (activityManager != null) {
            val amInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(amInfo)
            system.putBoolean("lowMemory", amInfo.lowMemory)
            system.putDouble("thresholdBytes", amInfo.threshold.toDouble())
        } else {
            system.putBoolean("lowMemory", false)
            system.putDouble("thresholdBytes", 0.0)
        }
        result.putMap("system", system)

        // 5. Android Debug Categories
        val androidDebug = Arguments.createMap()
        val debugMem = Debug.MemoryInfo()
        Debug.getMemoryInfo(debugMem)
        androidDebug.putDouble("nativeHeapBytes", debugMem.nativePss.toDouble() * 1024)
        androidDebug.putDouble("javaHeapBytes", debugMem.dalvikPss.toDouble() * 1024)
        androidDebug.putDouble("graphicsBytes", (debugMem.getMemoryStat("summary.graphics")?.toDouble() ?: 0.0) * 1024)
        androidDebug.putDouble("codeBytes", (debugMem.getMemoryStat("summary.code")?.toDouble() ?: 0.0) * 1024)
        androidDebug.putDouble("systemBytes", (debugMem.getMemoryStat("summary.system")?.toDouble() ?: 0.0) * 1024)
        androidDebug.putDouble("totalBytes", debugMem.totalPss.toDouble() * 1024)
        result.putMap("androidDebugMemory", androidDebug)

        return result
    }

    @ReactMethod
    fun getTopMemoryMappings(limit: Int, sortBy: String, promise: Promise) {
        try {
            val mappings = parseAllMappings()
            val sorted = when (sortBy.lowercase()) {
                "pss" -> mappings.sortedByDescending { it.pss }
                else -> mappings.sortedByDescending { it.rss }
            }
            
            val result = Arguments.createArray()
            val actualLimit = if (limit > 0) Math.min(limit, sorted.size) else Math.min(20, sorted.size)
            
            for (i in 0 until actualLimit) {
                val m = sorted[i]
                val map = Arguments.createMap()
                map.putString("range", m.range)
                map.putString("perms", m.perms)
                map.putDouble("sizeBytes", m.size.toDouble())
                map.putDouble("rssBytes", m.rss.toDouble())
                map.putDouble("pssBytes", m.pss.toDouble())
                map.putDouble("privateDirtyBytes", m.privateDirty.toDouble())
                map.putDouble("privateCleanBytes", m.privateClean.toDouble())
                map.putString("path", m.path)
                map.putString("category", m.category)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("MAPPINGS_ERROR", e.message)
        }
    }

    private data class VmaInfo(
        val range: String,
        val perms: String,
        val path: String,
        var size: Long = 0,
        var rss: Long = 0,
        var pss: Long = 0,
        var privateDirty: Long = 0,
        var privateClean: Long = 0,
        var sharedDirty: Long = 0,
        var sharedClean: Long = 0,
        var swap: Long = 0,
        var category: String = "unknown"
    )

    private fun parseAllMappings(): List<VmaInfo> {
        val mappings = ArrayList<VmaInfo>()
        try {
            val reader = BufferedReader(FileReader("/proc/self/smaps"))
            var line = reader.readLine()
            var currentVma: VmaInfo? = null

            while (line != null) {
                if (Regex("^[0-9a-fA-F]+-[0-9a-fA-F]+").containsMatchIn(line)) {
                    if (currentVma != null) mappings.add(currentVma)
                    
                    val parts = line.split(Regex("\\s+"))
                    val range = parts[0]
                    val perms = if (parts.size > 1) parts[1] else ""
                    val path = if (parts.size > 5) parts.subList(5, parts.size).joinToString(" ") else ""
                    
                    currentVma = VmaInfo(range, perms, path)
                    currentVma.category = classifyPath(path, perms)
                } else if (currentVma != null) {
                    val trimmed = line.trim()
                    val parts = trimmed.split(Regex("\\s+"))
                    if (parts.size >= 2) {
                        val key = parts[0].removeSuffix(":")
                        val value = (parts[1].toLongOrNull() ?: 0L) * 1024
                        when (key) {
                            "Size" -> currentVma!!.size = value
                            "Rss" -> currentVma!!.rss = value
                            "Pss" -> currentVma!!.pss = value
                            "Private_Dirty" -> currentVma!!.privateDirty = value
                            "Private_Clean" -> currentVma!!.privateClean = value
                            "Shared_Dirty" -> currentVma!!.sharedDirty = value
                            "Shared_Clean" -> currentVma!!.sharedClean = value
                            "Swap" -> currentVma!!.swap = value
                        }
                    }
                }
                line = reader.readLine()
            }
            if (currentVma != null) mappings.add(currentVma)
            reader.close()
        } catch (e: Exception) {}
        return mappings
    }

    private fun classifyPath(path: String, perms: String): String {
        if (path.isEmpty()) return "ANONYMOUS"
        if (path == "[anon]") return "ANONYMOUS"
        if (path.startsWith("/dev/kgsl-3d0")) return "GPU_GRAPHICS"
        if (path.startsWith("/dev/")) return "DEVICE"
        if (path.contains(".gguf", ignoreCase = true)) return "GGUF"
        if (path.contains("/dm-", ignoreCase = true)) return "STORAGE_DEVICE"
        if (path.startsWith("[stack")) return "STACK"
        if (path == "[heap]") return "HEAP"
        if (path.contains(".so")) return "CODE_LIB"
        if (path.contains(".apk") || path.contains(".dex") || path.contains(".jar")) return "CODE_ART"
        if (path.startsWith("/memfd:")) return "MEMFD"
        return "FILE_BACKED"
    }

    private fun parseMappings(onlyGguf: Boolean): WritableMap {
        val all = parseAllMappings()
        val result = Arguments.createMap()
        
        var count = 0
        var vSize = 0L
        var rss = 0L
        var pss = 0L
        var pDirty = 0L
        var pClean = 0L
        var sDirty = 0L
        var sClean = 0L
        var swap = 0L

        for (m in all) {
            if (onlyGguf && m.category != "GGUF") continue
            
            count++
            vSize += m.size
            rss += m.rss
            pss += m.pss
            pDirty += m.privateDirty
            pClean += m.privateClean
            sDirty += m.sharedDirty
            sClean += m.sharedClean
            swap += m.swap
        }

        result.putInt("mappingCount", count)
        result.putDouble("virtualSizeBytes", vSize.toDouble())
        result.putDouble("rssBytes", rss.toDouble())
        result.putDouble("pssBytes", pss.toDouble())
        result.putDouble("privateCleanBytes", pClean.toDouble())
        result.putDouble("privateDirtyBytes", pDirty.toDouble())
        result.putDouble("sharedCleanBytes", sClean.toDouble())
        result.putDouble("sharedDirtyBytes", sDirty.toDouble())
        result.putDouble("swapBytes", swap.toDouble())
        
        return result
    }

    private fun parseSmapsRollup(): Map<String, Long> {
        val result = HashMap<String, Long>()
        try {
            val file = File("/proc/self/smaps_rollup")
            if (file.exists()) {
                file.forEachLine { line ->
                    val trimmed = line.trim()
                    val parts = trimmed.split(Regex("\\s+"))
                    if (parts.size >= 2) {
                        val key = parts[0].removeSuffix(":")
                        val value = parts[1].toLongOrNull() ?: 0L
                        result[key] = value * 1024
                    }
                }
            }
        } catch (e: Exception) {
            Log.w("NASUKI_MEM", "Could not read smaps_rollup: ${e.message}")
        }
        if (result.isEmpty()) {
            Log.i("NASUKI_MEM", "smaps_rollup empty, attempting fallback to smaps summation")
            return parseSmapsManualRollup()
        }
        return result
    }

    private fun parseSmapsManualRollup(): Map<String, Long> {
        val result = HashMap<String, Long>()
        var rss = 0L
        var pss = 0L
        var pDirty = 0L
        var pClean = 0L
        var swap = 0L
        try {
            File("/proc/self/smaps").forEachLine { line ->
                val trimmed = line.trim()
                val parts = trimmed.split(Regex("\\s+"))
                if (parts.size >= 2) {
                    val key = parts[0].removeSuffix(":")
                    val value = (parts[1].toLongOrNull() ?: 0L) * 1024
                    when (key) {
                        "Rss" -> rss += value
                        "Pss" -> pss += value
                        "Private_Dirty" -> pDirty += value
                        "Private_Clean" -> pClean += value
                        "Swap" -> swap += value
                    }
                }
            }
            result["Rss"] = rss
            result["Pss"] = pss
            result["Private_Dirty"] = pDirty
            result["Private_Clean"] = pClean
            result["Swap"] = swap
        } catch (e: Exception) {}
        return result
    }

    private fun parseProcStatus(): Map<String, Long> {
        val result = HashMap<String, Long>()
        try {
            File("/proc/self/status").forEachLine { line ->
                val trimmed = line.trim()
                if (trimmed.startsWith("VmSize:") || trimmed.startsWith("VmRSS:") || 
                    trimmed.startsWith("RssAnon:") || trimmed.startsWith("RssFile:") || 
                    trimmed.startsWith("RssShmem:") || trimmed.startsWith("VmSwap:") ||
                    trimmed.startsWith("VmData:")) {
                    val parts = trimmed.split(Regex("\\s+"))
                    if (parts.size >= 2) {
                        val key = parts[0].removeSuffix(":")
                        val value = parts[1].toLongOrNull() ?: 0L
                        result[key] = value * 1024
                    }
                }
            }
        } catch (e: Exception) {}
        return result
    }

    private fun parsePageFaults(): WritableMap {
        val result = Arguments.createMap()
        try {
            val reader = BufferedReader(FileReader("/proc/self/stat"))
            val content = reader.readLine()
            reader.close()

            // Handle process name with parentheses: e.g. "1234 (com.app) S ..."
            val lastParen = content.lastIndexOf(')')
            val remainder = content.substring(lastParen + 2)
            val parts = remainder.split(" ")

            // Indices in stat after the comm field:
            // 0: state, 1: ppid, 2: pgrp, 3: session, 4: tty_nr, 5: tpgid, 6: flags
            // 7: minflt, 8: cminflt, 9: majflt, 10: cmajflt
            result.putDouble("minor", parts[7].toDouble())
            result.putDouble("major", parts[9].toDouble())
        } catch (e: Exception) {}
        return result
    }

    private fun parseMemInfo(): Map<String, Long> {
        val result = HashMap<String, Long>()
        try {
            File("/proc/meminfo").forEachLine { line ->
                val parts = line.split(Regex("\\s+"))
                if (parts.size >= 2) {
                    val key = parts[0].removeSuffix(":")
                    val value = parts[1].toLongOrNull() ?: 0L
                    result[key] = value * 1024
                }
            }
        } catch (e: Exception) {}
        return result
    }

    @ReactMethod
    fun getSystemMemoryStats(promise: Promise) {
        try {
            val result = Arguments.createMap()
            val memInfo = parseMemInfo()
            result.putDouble("memTotalBytes", (memInfo["MemTotal"] ?: 0L).toDouble())
            result.putDouble("memAvailableBytes", (memInfo["MemAvailable"] ?: 0L).toDouble())
            result.putDouble("cachedBytes", (memInfo["Cached"] ?: 0L).toDouble())
            result.putDouble("activeFileBytes", (memInfo["Active(file)"] ?: 0L).toDouble())
            result.putDouble("inactiveFileBytes", (memInfo["Inactive(file)"] ?: 0L).toDouble())
            result.putDouble("swapTotalBytes", (memInfo["SwapTotal"] ?: 0L).toDouble())
            result.putDouble("swapFreeBytes", (memInfo["SwapFree"] ?: 0L).toDouble())
            result.putDouble("timestampNs", SystemClock.elapsedRealtimeNanos().toDouble())

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SYSTEM_MEM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun allocateMemoryPressure(amountMB: Int, promise: Promise) {
        if (amountMB <= 0) {
            promise.reject("INVALID_ARG", "Amount must be positive")
            return
        }
        try {
            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val memoryInfo = ActivityManager.MemoryInfo()
            activityManager?.getMemoryInfo(memoryInfo)

            val safeLimit = (memoryInfo.availMem * 0.6).toLong()
            val requestedBytes = amountMB.toLong() * 1024 * 1024

            if (requestedBytes > safeLimit || memoryInfo.lowMemory) {
                promise.reject("SAFETY_ABORT", "Requested allocation exceeds safety threshold")
                return
            }

            val chunkSize = 16 * 1024 * 1024
            var remaining = requestedBytes
            
            while (remaining > 0) {
                val currentChunk = if (remaining > chunkSize.toLong()) chunkSize else remaining.toInt()
                val array = ByteArray(currentChunk)
                var j = 0
                while (j < currentChunk) {
                    array[j] = 1
                    j += 4096
                }
                pressureAllocations.add(array)
                remaining -= currentChunk
            }

            val result = Arguments.createMap()
            result.putInt("allocatedMB", amountMB)
            promise.resolve(result)
        } catch (e: OutOfMemoryError) {
            releaseMemoryPressureInternal()
            promise.reject("OOM", "Native OOM during pressure allocation")
        } catch (e: Exception) {
            promise.reject("PRESSURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun releaseMemoryPressure(promise: Promise) {
        releaseMemoryPressureInternal()
        promise.resolve(null)
    }

    private fun releaseMemoryPressureInternal() {
        pressureAllocations.clear()
        System.gc()
    }

    @ReactMethod
    fun isPerformanceHintSupported(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            promise.resolve(false)
            return
        }
        val manager = reactContext.getSystemService(Context.PERFORMANCE_HINT_SERVICE) as? PerformanceHintManager
        promise.resolve(manager != null)
    }

    @ReactMethod
    fun startPerformanceSession(tids: ReadableArray, targetDurationNanos: Double, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            promise.reject("UNSUPPORTED", "ADPF requires Android 12+")
            return
        }

        try {
            val manager = reactContext.getSystemService(Context.PERFORMANCE_HINT_SERVICE) as? PerformanceHintManager
                ?: throw Exception("PerformanceHintManager not available")

            if (tids.size() == 0) {
                promise.reject("INVALID_ARG", "TID list cannot be empty")
                return
            }

            val tidsArray = IntArray(tids.size())
            var i = 0
            while (i < tids.size()) {
                tidsArray[i] = tids.getInt(i)
                i++
            }

            val oldSession = performanceSession as? PerformanceHintManager.Session
            if (oldSession != null) {
                oldSession.close()
            }

            val session = manager.createHintSession(tidsArray, targetDurationNanos.toLong())
            performanceSession = session
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("NASUKI_ADAPTIVE", "Failed to start ADPF session", e)
            promise.reject("SESSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun reportActualWorkDuration(actualDurationNanos: Double, promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val session = performanceSession as? PerformanceHintManager.Session
            if (session != null) {
                session.reportActualWorkDuration(actualDurationNanos.toLong())
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun closePerformanceSession(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val session = performanceSession as? PerformanceHintManager.Session
            if (session != null) {
                session.close()
            }
            performanceSession = null
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun registerThermalListener(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.resolve(false)
            return
        }

        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (pm != null && thermalListener == null) {
            val listener = object : PowerManager.OnThermalStatusChangedListener {
                override fun onThermalStatusChanged(status: Int) {
                    val params = Arguments.createMap()
                    params.putInt("thermalStatus", status)
                    sendEvent("nasukiThermalStatusChanged", params)
                }
            }
            
            try {
                // Defensive reflection for Thermal API
                val pmClass = pm::class.java
                val listenerClass = PowerManager.OnThermalStatusChangedListener::class.java
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Try to find getMainExecutor via reflection
                    val getExecutorMethod = reactContext::class.java.getMethod("getMainExecutor")
                    val executor = getExecutorMethod.invoke(reactContext) as Executor
                    val addMethod = pmClass.getMethod("addThermalStatusChangedListener", Executor::class.java, listenerClass)
                    addMethod.invoke(pm, executor, listener)
                } else {
                    val addMethod = pmClass.getMethod("addThermalStatusChangedListener", listenerClass)
                    addMethod.invoke(pm, listener)
                }
                thermalListener = listener
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("NASUKI_ADAPTIVE", "Thermal listener registration failed via reflection", e)
                promise.resolve(false)
            }
        } else {
            promise.resolve(thermalListener != null)
        }
    }

    @ReactMethod
    fun unregisterThermalListener(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val listener = thermalListener
            if (pm != null && listener != null) {
                try {
                    val pmClass = pm::class.java
                    val listenerClass = PowerManager.OnThermalStatusChangedListener::class.java
                    val removeMethod = pmClass.getMethod("removeThermalStatusChangedListener", listenerClass)
                    removeMethod.invoke(pm, listener)
                } catch (e: Exception) {}
                thermalListener = null
            }
        }
        promise.resolve(null)
    }

    @ReactMethod
    fun warmupModel(path: String, promise: Promise) {
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Model file not found at: " + path)
                return
            }

            // MappedByteBuffer.load() removed - it was forcing full residency
            // and causing OOM on 4GB devices for large models.
            // Paging is now handled lazily by llama.rn/llama.cpp mmap.
            
            Log.i("NASUKI_ADAPTIVE", "Warmup bypassed (lazy mmap enabled): " + path)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("NASUKI_ADAPTIVE", "Warmup logic check failed: " + e.message)
            promise.resolve(false)
        }
    }

    override fun invalidate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val listener = thermalListener
            if (pm != null && listener != null) {
                try {
                    val pmClass = pm::class.java
                    val listenerClass = PowerManager.OnThermalStatusChangedListener::class.java
                    val removeMethod = pmClass.getMethod("removeThermalStatusChangedListener", listenerClass)
                    removeMethod.invoke(pm, listener)
                } catch (e: Exception) {}
                thermalListener = null
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val session = performanceSession as? PerformanceHintManager.Session
            if (session != null) {
                session.close()
            }
            performanceSession = null
        }
        
        releaseMemoryPressureInternal()
        
        super.invalidate()
    }

    private fun bytesToMB(bytes: Long): Double = bytes / (1024.0 * 1024.0)

    private fun calculatePercentage(used: Long, total: Long): Double {
        if (total <= 0) return 0.0
        return (used * 100.0) / total
    }
}
