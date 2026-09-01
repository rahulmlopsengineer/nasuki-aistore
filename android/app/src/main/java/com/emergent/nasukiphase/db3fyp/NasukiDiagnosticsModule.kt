package com.emergent.nasukiphase.db3fyp

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Debug
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class NasukiDiagnosticsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DeviceDiagnostics"

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        try {
            val result = Arguments.createMap()

            // DEVICE
            result.putString("manufacturer", Build.MANUFACTURER)
            result.putString("model", Build.MODEL)
            result.putString("device", Build.DEVICE)
            result.putString("brand", Build.BRAND)
            result.putString("androidVersion", Build.VERSION.RELEASE)
            result.putInt("sdkVersion", Build.VERSION.SDK_INT)

            // CPU
            result.putInt("availableProcessors", Runtime.getRuntime().availableProcessors())
            result.putString("supportedAbis", Build.SUPPORTED_ABIS.joinToString(","))

            // RAM
            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val memoryInfo = ActivityManager.MemoryInfo()

            if (activityManager != null) {
                activityManager.getMemoryInfo(memoryInfo)
                result.putDouble("totalRamMB", bytesToMB(memoryInfo.totalMem))
                result.putDouble("availableRamMB", bytesToMB(memoryInfo.availMem))
                result.putDouble("usedRamMB", bytesToMB(memoryInfo.totalMem - memoryInfo.availMem))
                result.putDouble("ramUsagePercent", calculatePercentage(memoryInfo.totalMem - memoryInfo.availMem, memoryInfo.totalMem))
                result.putBoolean("lowMemory", memoryInfo.lowMemory)
            }

            // APP MEMORY
            val appMemory = Debug.MemoryInfo()
            Debug.getMemoryInfo(appMemory)
            result.putDouble("appPssMB", appMemory.totalPss / 1024.0)

            // HEAP
            val runtime = Runtime.getRuntime()
            val maxHeap = runtime.maxMemory()
            val usedHeap = runtime.totalMemory() - runtime.freeMemory()
            result.putDouble("maxHeapMB", bytesToMB(maxHeap))
            result.putDouble("usedHeapMB", bytesToMB(usedHeap))
            result.putDouble("heapUsagePercent", calculatePercentage(usedHeap, maxHeap))

            // LOW RAM DEVICE
            if (activityManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                result.putBoolean("isLowRamDevice", activityManager.isLowRamDevice)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DEVICE_DIAGNOSTICS_ERROR", e.message, e)
        }
    }

    private fun bytesToMB(bytes: Long): Double = bytes / (1024.0 * 1024.0)

    private fun calculatePercentage(used: Long, total: Long): Double {
        if (total <= 0) return 0.0
        return (used * 100.0) / total
    }
}
