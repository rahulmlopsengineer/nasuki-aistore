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
                    result.putDouble("thermalHeadroom", pm.getThermalHeadroom(0).toDouble())
                } else {
                    result.putDouble("thermalHeadroom", -1.0)
                }
            }

            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (activityManager != null) {
                val memoryInfo = ActivityManager.MemoryInfo()
                activityManager.getMemoryInfo(memoryInfo)
                result.putDouble("availableRamMB", bytesToMB(memoryInfo.availMem))
                result.putDouble("totalRamMB", bytesToMB(memoryInfo.totalMem))
                result.putBoolean("lowMemory", memoryInfo.lowMemory)
            }

            val appMemory = Debug.MemoryInfo()
            Debug.getMemoryInfo(appMemory)
            result.putDouble("appPssMB", appMemory.totalPss / 1024.0)

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
    fun getProcessStats(promise: Promise) {
        try {
            val reader = BufferedReader(FileReader("/proc/self/stat"))
            val content = reader.readLine()
            reader.close()
            
            val parts = content.split(" ")
            
            val result = Arguments.createMap()
            // minflt: index 9, majflt: index 11
            result.putDouble("minorFaults", java.lang.Double.parseDouble(parts.get(9)))
            result.putDouble("majorFaults", java.lang.Double.parseDouble(parts.get(11)))
            result.putDouble("timestampNs", SystemClock.elapsedRealtimeNanos().toDouble())
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("PROCESS_STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getSystemMemoryStats(promise: Promise) {
        try {
            val memInfo = HashMap<String, Long>()
            val reader = BufferedReader(FileReader("/proc/meminfo"))
            var line = reader.readLine()
            while (line != null) {
                val lineStr = line as java.lang.String
                val colonIdx = lineStr.indexOf(":")
                if (colonIdx > 0) {
                    val key = lineStr.substring(0, colonIdx).trim()
                    val valuePart = lineStr.substring(colonIdx + 1).trim()
                    val firstSpace = valuePart.indexOf(" ")
                    val numStr = if (firstSpace > 0) valuePart.substring(0, firstSpace) else valuePart
                    try {
                        memInfo.put(key, java.lang.Long.parseLong(numStr) * 1024)
                    } catch (ex: Exception) {}
                }
                line = reader.readLine()
            }
            reader.close()

            val result = Arguments.createMap()
            result.putDouble("memTotalBytes", (memInfo.get("MemTotal") ?: 0L).toDouble())
            result.putDouble("memAvailableBytes", (memInfo.get("MemAvailable") ?: 0L).toDouble())
            result.putDouble("cachedBytes", (memInfo.get("Cached") ?: 0L).toDouble())
            result.putDouble("activeFileBytes", (memInfo.get("Active(file)") ?: 0L).toDouble())
            result.putDouble("inactiveFileBytes", (memInfo.get("Inactive(file)") ?: 0L).toDouble())
            result.putDouble("swapTotalBytes", (memInfo.get("SwapTotal") ?: 0L).toDouble())
            result.putDouble("swapFreeBytes", (memInfo.get("SwapFree") ?: 0L).toDouble())
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
        var raf: RandomAccessFile? = null
        try {
            val file = File(path)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Model file not found at: " + path)
                return
            }

            raf = RandomAccessFile(file, "r")
            val channel = raf.channel
            val size = channel.size()
            val buffer = channel.map(FileChannel.MapMode.READ_ONLY, 0, size)
            buffer.load()
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w("NASUKI_ADAPTIVE", "Experimental warmup failed: " + e.message)
            promise.resolve(false)
        } finally {
            if (raf != null) {
                try {
                    raf.close()
                } catch (e2: Exception) {}
            }
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
