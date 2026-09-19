package com.fruitninja.hands

import android.content.Context
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult

data class DetectorConfig(
    val numHands: Int,
    /** "cpu", "gpu" or "auto" (try GPU, fall back to CPU). */
    val delegate: String,
    val minDetectionConfidence: Float,
    val minPresenceConfidence: Float,
    val minTrackingConfidence: Float,
)

/**
 * Owns one MediaPipe HandLandmarker in LIVE_STREAM mode (result callback,
 * monotonic millisecond timestamps via `detectAsync`). All access to the native
 * task is serialised by [lock] so `close()` can never race with `detectAsync()`.
 */
class HandDetector private constructor(
    private val landmarker: HandLandmarker,
    /** The delegate actually in use: "cpu" or "gpu". */
    val delegate: String,
) {
    private val lock = Any()

    @Volatile
    private var closed = false

    /** Returns false if the detector is already closed. */
    fun submit(image: MPImage, options: ImageProcessingOptions, timestampMs: Long): Boolean =
        synchronized(lock) {
            if (closed) {
                false
            } else {
                landmarker.detectAsync(image, options, timestampMs)
                true
            }
        }

    fun close() {
        synchronized(lock) {
            if (!closed) {
                closed = true
                landmarker.close()
            }
        }
    }

    companion object {
        const val MODEL_ASSET = "hand_landmarker.task"

        /**
         * Creates the detector. Blocking (loads the model): call off the main thread.
         * With delegate "auto" a GPU failure falls back to CPU; with "gpu" it is rethrown.
         */
        fun create(
            context: Context,
            config: DetectorConfig,
            onResult: (HandLandmarkerResult, MPImage) -> Unit,
            onError: (RuntimeException) -> Unit,
        ): HandDetector {
            fun build(delegate: Delegate): HandLandmarker {
                val base = BaseOptions.builder()
                    .setModelAssetPath(MODEL_ASSET)
                    .setDelegate(delegate)
                    .build()
                val options = HandLandmarker.HandLandmarkerOptions.builder()
                    .setBaseOptions(base)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setNumHands(config.numHands)
                    .setMinHandDetectionConfidence(config.minDetectionConfidence)
                    .setMinHandPresenceConfidence(config.minPresenceConfidence)
                    .setMinTrackingConfidence(config.minTrackingConfidence)
                    .setResultListener { result, input -> onResult(result, input) }
                    .setErrorListener { error -> onError(error) }
                    .build()
                return HandLandmarker.createFromOptions(context, options)
            }

            return when (config.delegate) {
                "gpu" -> HandDetector(build(Delegate.GPU), "gpu")
                "auto" -> try {
                    HandDetector(build(Delegate.GPU), "gpu")
                } catch (gpuFailure: Exception) {
                    HandDetector(build(Delegate.CPU), "cpu")
                }
                else -> HandDetector(build(Delegate.CPU), "cpu")
            }
        }
    }
}
