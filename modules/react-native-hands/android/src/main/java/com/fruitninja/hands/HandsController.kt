package com.fruitninja.hands

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Size
import android.view.Surface
import android.view.WindowManager
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.Observer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.fruitninja.hands.core.InFlightTracker
import com.fruitninja.hands.core.LandmarkPacker
import com.fruitninja.hands.core.MonotonicTimestamps
import com.fruitninja.hands.core.RollingStats
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import java.nio.ByteBuffer
import java.util.ArrayDeque
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

data class StartConfig(
    val front: Boolean,
    val numHands: Int,
    val delegate: String,
    val minDetectionConfidence: Float,
    val minPresenceConfidence: Float,
    val minTrackingConfidence: Float,
    val analysisWidth: Int,
    val analysisHeight: Int,
    val maxInFlight: Int,
    val maxEmitHz: Int,
) {
    val lensName: String get() = if (front) "front" else "back"
}

/** Process-wide handle so the preview view can find the controller without a React tag. */
object HandsRegistry {
    @Volatile
    var controller: HandsController? = null
}

/**
 * The single owner of the camera and the hand detector.
 *
 * Invariants:
 *  - Only this class binds CameraX use cases. There is no second camera owner.
 *  - At most one [Session] is live. A session carries an id; every callback that
 *    can outlive it (analyzer, detector result, camera state) checks that its
 *    session is still current, so results from before a restart are discarded.
 *  - Every ImageProxy is closed in a `finally`. Pixel data is copied into an
 *    owned Bitmap before the proxy is closed, so asynchronous inference never
 *    touches memory that CameraX has recycled.
 *  - Analysis is bounded: back-pressure is KEEP_ONLY_LATEST plus an in-flight
 *    cap, and a frame that cannot be admitted is dropped (and counted).
 *  - Everything is torn down (camera unbound, analyzer cleared, detector
 *    closed) on stop, on backgrounding and when the module is invalidated.
 */
class HandsController(
    private val reactContext: ReactApplicationContext,
    private val sink: EventSink,
) {
    interface EventSink {
        fun onHandFrame(map: WritableMap)
        fun onState(map: WritableMap)
    }

    private class Stats {
        val framesReceived = AtomicLong()
        val framesDroppedBusy = AtomicLong()
        val framesSubmitted = AtomicLong()
        val resultsReceived = AtomicLong()
        val resultsObsolete = AtomicLong()
        val samplesEmitted = AtomicLong()
        val errors = AtomicLong()
        val inferenceMs = RollingStats(300)
    }

    /** What a frame owns while it is inside the detector. */
    private class Frame(
        val bitmap: Bitmap,
        val frameTimeMs: Double,
        val rotationDegrees: Int,
        val uprightWidth: Int,
        val uprightHeight: Int,
    )

    private class BitmapPool(private val max: Int) {
        private val free = ArrayDeque<Bitmap>()
        private var created = 0
        private var width = 0
        private var height = 0

        @Synchronized
        fun acquire(w: Int, h: Int): Bitmap? {
            if (w != width || h != height) {
                free.forEach { it.recycle() }
                free.clear()
                created = 0
                width = w
                height = h
            }
            free.pollFirst()?.let { return it }
            if (created < max) {
                created++
                return Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            }
            return null
        }

        @Synchronized
        fun release(b: Bitmap) {
            if (b.isRecycled) return
            if (b.width == width && b.height == height && free.size < max) free.addLast(b) else b.recycle()
        }

        @Synchronized
        fun clear() {
            free.forEach { it.recycle() }
            free.clear()
            created = 0
        }
    }

    private inner class Session(val id: Int, val config: StartConfig) {
        @Volatile
        var active = true

        val analysisExecutor: ExecutorService =
            Executors.newSingleThreadExecutor { r -> Thread(r, "hands-analyzer-$id") }
        val mono = MonotonicTimestamps()
        val stats = Stats()
        val seq = AtomicLong()
        val pool = BitmapPool(config.maxInFlight)
        val tracker = InFlightTracker<Frame>(
            maxInFlight = config.maxInFlight,
            timeoutMs = 1000,
            clockMs = { SystemClock.elapsedRealtime() },
        )

        @Volatile
        var detector: HandDetector? = null
        var provider: ProcessCameraProvider? = null
        var camera: Camera? = null
        var preview: Preview? = null
        var analysis: ImageAnalysis? = null
        var lifecycleOwner: LifecycleOwner? = null
        var stateObserver: Observer<CameraState>? = null
        var displayListener: DisplayManager.DisplayListener? = null

        @Volatile
        var lastEmitMs = 0L

        val delegateName: String get() = detector?.delegate ?: config.delegate
    }

    private val main = Handler(Looper.getMainLooper())
    private val io: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(r, "hands-io") }
    private val sessionSeq = AtomicInteger(0)

    @Volatile
    private var session: Session? = null
    private var lastStats: Stats? = null
    private var lastStatsSession = 0
    private var lastStatsDelegate = "cpu"

    // Main-thread only.
    private var previewProvider: Preview.SurfaceProvider? = null

    // ----------------------------------------------------------------- public API

    fun start(config: StartConfig, promise: Promise) {
        main.post {
            try {
                startOnMain(config, promise)
            } catch (t: Throwable) {
                promise.reject("E_START", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }

    fun stop(reason: String, promise: Promise? = null) {
        main.post {
            stopOnMain(reason)
            promise?.resolve(null)
        }
    }

    fun shutdown() {
        main.post {
            stopOnMain("destroyed")
        }
    }

    fun attachPreview(provider: Preview.SurfaceProvider) {
        main.post {
            previewProvider = provider
            session?.let { s ->
                if (s.camera != null) bindUseCases(s, null)
            }
        }
    }

    fun detachPreview(provider: Preview.SurfaceProvider) {
        main.post {
            if (previewProvider === provider) {
                previewProvider = null
                session?.let { s ->
                    if (s.camera != null) bindUseCases(s, null)
                }
            }
        }
    }

    fun statsMap(): WritableMap {
        val s = lastStats
        val map = Arguments.createMap()
        map.putInt("sessionId", lastStatsSession)
        map.putString("delegate", lastStatsDelegate)
        map.putDouble("framesReceived", (s?.framesReceived?.get() ?: 0).toDouble())
        map.putDouble("framesDroppedBusy", (s?.framesDroppedBusy?.get() ?: 0).toDouble())
        map.putDouble("framesSubmitted", (s?.framesSubmitted?.get() ?: 0).toDouble())
        map.putDouble("resultsReceived", (s?.resultsReceived?.get() ?: 0).toDouble())
        map.putDouble("resultsObsolete", (s?.resultsObsolete?.get() ?: 0).toDouble())
        map.putDouble("samplesEmitted", (s?.samplesEmitted?.get() ?: 0).toDouble())
        map.putDouble("errors", (s?.errors?.get() ?: 0).toDouble())
        map.putDouble("inferenceMsAvg", s?.inferenceMs?.average() ?: 0.0)
        map.putDouble("inferenceMsP95", s?.inferenceMs?.percentile(95.0) ?: 0.0)
        return map
    }

    // ------------------------------------------------------------------ start / stop

    private fun startOnMain(config: StartConfig, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity !is LifecycleOwner) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity to bind the camera to")
            return
        }
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            promise.reject("E_PERMISSION", "Camera permission is not granted")
            return
        }
        when (Cameras.lensStatus(reactContext, config.front)) {
            Cameras.LensStatus.NO_CAMERA -> {
                promise.reject("E_NO_CAMERA", "This device has no ${config.lensName} camera")
                return
            }
            Cameras.LensStatus.DISABLED -> {
                promise.reject("E_CAMERA_DISABLED", "Camera access is disabled by device policy")
                return
            }
            else -> Unit // OK or unknown: let CameraX report a precise error
        }
        val model = ModelIntegrity.check(reactContext)
        if (!model.present || !model.ok) {
            promise.reject(
                "E_MODEL",
                if (!model.present) "Hand model asset is missing" else "Hand model checksum mismatch",
            )
            return
        }

        // Only one session may exist: release the previous one completely first.
        stopOnMain("restart")

        val s = Session(sessionSeq.incrementAndGet(), config)
        session = s
        lastStats = s.stats
        lastStatsSession = s.id
        emitState(s, "starting", "", "")

        // Loading the model is slow: do it off the main thread.
        io.execute {
            val detector = try {
                HandDetector.create(
                    reactContext,
                    DetectorConfig(
                        numHands = config.numHands,
                        delegate = config.delegate,
                        minDetectionConfidence = config.minDetectionConfidence,
                        minPresenceConfidence = config.minPresenceConfidence,
                        minTrackingConfidence = config.minTrackingConfidence,
                    ),
                    onResult = { result, _ -> onResult(s, result) },
                    onError = { e -> onDetectorError(s, e) },
                )
            } catch (t: Throwable) {
                main.post {
                    if (session === s) {
                        reportError(s, "E_MODEL", t.message ?: "Could not create the hand detector")
                        stopOnMain("error")
                    }
                    promise.reject("E_MODEL", t.message ?: "Could not create the hand detector", t)
                }
                return@execute
            }
            main.post {
                if (session !== s || !s.active) {
                    // Superseded while the model was loading.
                    io.execute { detector.close() }
                    promise.reject("E_CANCELLED", "Session was superseded")
                } else {
                    s.detector = detector
                    bindUseCases(s, promise)
                }
            }
        }
    }

    private fun stopOnMain(reason: String) {
        val s = session ?: return
        session = null
        s.active = false

        val owner = s.lifecycleOwner
        val observer = s.stateObserver
        try {
            if (owner != null && observer != null) {
                s.camera?.cameraInfo?.cameraState?.removeObserver(observer)
            }
        } catch (_: Throwable) {
        }
        s.displayListener?.let { l ->
            try {
                (reactContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager)
                    .unregisterDisplayListener(l)
            } catch (_: Throwable) {
            }
        }
        // Unbind FIRST so no new frames arrive, then drain and close.
        try {
            s.provider?.unbindAll()
        } catch (_: Throwable) {
        }
        try {
            s.analysis?.clearAnalyzer()
        } catch (_: Throwable) {
        }
        s.camera = null
        s.preview = null
        s.analysis = null
        lastStatsDelegate = s.delegateName
        emitState(s, "stopped", reason, "")

        // Blocking teardown happens off the main thread.
        io.execute {
            s.analysisExecutor.shutdown()
            try {
                s.analysisExecutor.awaitTermination(800, TimeUnit.MILLISECONDS)
            } catch (_: InterruptedException) {
            }
            s.detector?.close()
            s.tracker.clear().forEach { s.pool.release(it.payload.bitmap) }
            s.pool.clear()
        }
    }

    // ----------------------------------------------------------------------- CameraX

    @Suppress("DEPRECATION")
    private fun displayRotation(): Int {
        val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        return wm?.defaultDisplay?.rotation ?: Surface.ROTATION_0
    }

    private fun bindUseCases(s: Session, promise: Promise?) {
        val owner = reactContext.currentActivity as? LifecycleOwner
        if (owner == null) {
            promise?.reject("E_NO_ACTIVITY", "No foreground activity to bind the camera to")
            return
        }
        val future = ProcessCameraProvider.getInstance(reactContext)
        future.addListener(
            {
                try {
                    if (session !== s || !s.active) {
                        promise?.reject("E_CANCELLED", "Session was superseded")
                        return@addListener
                    }
                    val provider = future.get()
                    s.provider = provider
                    s.lifecycleOwner = owner
                    val selector =
                        if (s.config.front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                    val rotation = displayRotation()

                    val analysis = buildAnalysis(s, rotation)
                    val group = UseCaseGroup.Builder()
                    val provided = previewProvider
                    if (provided != null) {
                        val preview = buildPreview(rotation)
                        preview.setSurfaceProvider(provided)
                        s.preview = preview
                        group.addUseCase(preview)
                    } else {
                        s.preview = null
                    }
                    group.addUseCase(analysis)

                    // Remove observers/analyzer from a previous bind of this session.
                    s.stateObserver?.let { old ->
                        try {
                            s.camera?.cameraInfo?.cameraState?.removeObserver(old)
                        } catch (_: Throwable) {
                        }
                    }
                    provider.unbindAll()
                    val camera = provider.bindToLifecycle(owner, selector, group.build())
                    s.camera = camera
                    s.analysis = analysis
                    analysis.setAnalyzer(s.analysisExecutor, FrameAnalyzer(s))

                    val observer = Observer<CameraState> { cs -> onCameraState(s, cs) }
                    s.stateObserver = observer
                    camera.cameraInfo.cameraState.observe(owner, observer)
                    registerDisplayListener(s)

                    if (promise != null) {
                        emitState(s, "running", "", "")
                        val result = Arguments.createMap()
                        result.putInt("sessionId", s.id)
                        result.putString("lens", s.config.lensName)
                        result.putString("delegate", s.delegateName)
                        promise.resolve(result)
                    }
                } catch (t: Throwable) {
                    if (session === s) {
                        reportError(s, "E_CAMERA_BIND", t.message ?: t.javaClass.simpleName)
                        stopOnMain("error")
                    }
                    promise?.reject("E_CAMERA_BIND", t.message ?: t.javaClass.simpleName, t)
                }
            },
            ContextCompat.getMainExecutor(reactContext),
        )
    }

    private fun sameAspectSelector(width: Int, height: Int): ResolutionSelector {
        val landscape = Size(maxOf(width, height), minOf(width, height))
        return ResolutionSelector.Builder()
            // Preview and analysis both use 4:3 so they share one field of view.
            // That is what lets a normalised landmark be mapped onto the preview.
            .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
            .setResolutionStrategy(
                ResolutionStrategy(landscape, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
            )
            .build()
    }

    private fun buildPreview(rotation: Int): Preview =
        Preview.Builder()
            .setResolutionSelector(sameAspectSelector(1280, 960))
            .setTargetRotation(rotation)
            .build()

    private fun buildAnalysis(s: Session, rotation: Int): ImageAnalysis =
        ImageAnalysis.Builder()
            .setResolutionSelector(sameAspectSelector(s.config.analysisWidth, s.config.analysisHeight))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
            .setTargetRotation(rotation)
            .build()

    /** The activity handles configuration changes itself, so rotation must be pushed to the use cases. */
    private fun registerDisplayListener(s: Session) {
        s.displayListener?.let { return }
        val dm = reactContext.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return
        val listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) = Unit
            override fun onDisplayRemoved(displayId: Int) = Unit
            override fun onDisplayChanged(displayId: Int) {
                if (session !== s) return
                val r = displayRotation()
                s.analysis?.targetRotation = r
                s.preview?.targetRotation = r
            }
        }
        s.displayListener = listener
        dm.registerDisplayListener(listener, main)
    }

    private fun onCameraState(s: Session, cs: CameraState) {
        if (session !== s) return
        val err = cs.error ?: return
        val code = when (err.code) {
            CameraState.ERROR_CAMERA_IN_USE, CameraState.ERROR_MAX_CAMERAS_IN_USE -> "E_CAMERA_IN_USE"
            CameraState.ERROR_CAMERA_DISABLED -> "E_CAMERA_DISABLED"
            CameraState.ERROR_DO_NOT_DISTURB_MODE_ENABLED -> "E_CAMERA_DND"
            CameraState.ERROR_CAMERA_FATAL_ERROR -> "E_CAMERA_FATAL"
            CameraState.ERROR_STREAM_CONFIG -> "E_CAMERA_STREAM"
            else -> "E_CAMERA_OTHER"
        }
        reportError(s, code, "CameraX error ${err.code}")
    }

    // ------------------------------------------------------------------ frame path

    private inner class FrameAnalyzer(private val s: Session) : ImageAnalysis.Analyzer {
        override fun analyze(image: ImageProxy) {
            var claimed: Bitmap? = null
            var stamp = 0L
            try {
                if (!s.active || session !== s) return
                val arrivalMs = SystemClock.elapsedRealtimeNanos() / 1_000_000.0
                s.stats.framesReceived.incrementAndGet()
                val detector = s.detector ?: return

                // Release frames whose result never came back (dropped by MediaPipe).
                s.tracker.drainExpired().forEach { s.pool.release(it.payload.bitmap) }
                if (!s.tracker.hasCapacity()) {
                    s.stats.framesDroppedBusy.incrementAndGet()
                    return
                }
                val bitmap = s.pool.acquire(image.width, image.height)
                if (bitmap == null) {
                    s.stats.framesDroppedBusy.incrementAndGet()
                    return
                }
                claimed = bitmap
                // Copy while the proxy is still open: the proxy is closed in `finally`.
                copyRgbaInto(image, bitmap)

                val rotation = image.imageInfo.rotationDegrees
                val sideways = rotation == 90 || rotation == 270
                stamp = s.mono.next(arrivalMs.toLong())
                val frame = Frame(
                    bitmap = bitmap,
                    frameTimeMs = arrivalMs,
                    rotationDegrees = rotation,
                    uprightWidth = if (sideways) image.height else image.width,
                    uprightHeight = if (sideways) image.width else image.height,
                )
                if (!s.tracker.tryAdd(stamp, frame)) {
                    s.stats.framesDroppedBusy.incrementAndGet()
                    return // `claimed` is returned to the pool below
                }
                claimed = null // now owned by the tracker until the result arrives

                val options = ImageProcessingOptions.builder().setRotationDegrees(rotation).build()
                val submitted = try {
                    detector.submit(BitmapImageBuilder(bitmap).build(), options, stamp)
                } catch (t: Throwable) {
                    s.tracker.remove(stamp)?.let { s.pool.release(it.payload.bitmap) }
                    s.stats.errors.incrementAndGet()
                    reportError(s, "E_INFERENCE", t.message ?: t.javaClass.simpleName)
                    return
                }
                if (submitted) {
                    s.stats.framesSubmitted.incrementAndGet()
                } else {
                    s.tracker.remove(stamp)?.let { s.pool.release(it.payload.bitmap) }
                }
            } catch (t: Throwable) {
                s.stats.errors.incrementAndGet()
                reportError(s, "E_FRAME", t.message ?: t.javaClass.simpleName)
            } finally {
                claimed?.let { s.pool.release(it) }
                image.close() // ALWAYS: an unclosed proxy stalls the whole analysis stream
            }
        }
    }

    /** Copies the RGBA plane into `bitmap`, honouring row padding. */
    private fun copyRgbaInto(image: ImageProxy, bitmap: Bitmap) {
        val plane = image.planes[0]
        val buffer: ByteBuffer = plane.buffer
        buffer.rewind()
        val width = image.width
        val height = image.height
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        if (pixelStride == 4 && rowStride == width * 4) {
            bitmap.copyPixelsFromBuffer(buffer)
            return
        }
        // Padded rows: repack tightly.
        val tight = ByteBuffer.allocate(width * height * 4)
        val row = ByteArray(width * 4)
        for (y in 0 until height) {
            buffer.position(y * rowStride)
            buffer.get(row, 0, width * 4)
            tight.put(row)
        }
        tight.rewind()
        bitmap.copyPixelsFromBuffer(tight)
    }

    private fun onResult(s: Session, result: HandLandmarkerResult) {
        val completion = s.tracker.complete(result.timestampMs())
        // Frames MediaPipe dropped and the matched frame free their bitmaps here.
        completion.droppedOlder.forEach { s.pool.release(it.payload.bitmap) }
        val matched = completion.matched
        try {
            if (matched == null) return
            s.stats.resultsReceived.incrementAndGet()
            // Reject callbacks that outlived their session (restart / stop).
            if (!s.active || session !== s) {
                s.stats.resultsObsolete.incrementAndGet()
                return
            }
            val nowMs = SystemClock.elapsedRealtime()
            val minIntervalMs = if (s.config.maxEmitHz > 0) 1000.0 / s.config.maxEmitHz else 0.0
            if (minIntervalMs > 0 && nowMs - s.lastEmitMs < minIntervalMs) return
            s.lastEmitMs = nowMs

            val submittedAt = matched.submittedAtMs
            val inferenceMs = (nowMs - submittedAt).toDouble().coerceAtLeast(0.0)
            s.stats.inferenceMs.add(inferenceMs)

            val frame = matched.payload
            val hands = result.landmarks()
            val indices = LandmarkPacker.validHandIndices(hands, s.config.numHands)
            val xy = LandmarkPacker.packXY(hands, indices)
            val handedness = result.handedness()

            val map = Arguments.createMap()
            map.putInt("sessionId", s.id)
            map.putDouble("seq", s.seq.incrementAndGet().toDouble())
            map.putDouble("frameTimeMs", frame.frameTimeMs)
            map.putDouble("emitTimeMs", SystemClock.elapsedRealtimeNanos() / 1_000_000.0)
            map.putInt("imageWidth", frame.uprightWidth)
            map.putInt("imageHeight", frame.uprightHeight)
            map.putInt("rotationDegrees", frame.rotationDegrees)
            map.putString("lens", s.config.lensName)
            map.putDouble("inferenceMs", inferenceMs)
            map.putInt("handCount", indices.size)
            val lm = Arguments.createArray()
            for (v in xy) lm.pushDouble(v)
            map.putArray("landmarks", lm)
            val hd = Arguments.createArray()
            val hs = Arguments.createArray()
            for (i in indices) {
                val cats = handedness.getOrNull(i)
                hd.pushInt(LandmarkPacker.handedness(cats))
                hs.pushDouble(LandmarkPacker.handednessScore(cats))
            }
            map.putArray("handedness", hd)
            map.putArray("handednessScore", hs)
            s.stats.samplesEmitted.incrementAndGet()
            sink.onHandFrame(map)
        } finally {
            matched?.let { s.pool.release(it.payload.bitmap) }
        }
    }

    private fun onDetectorError(s: Session, e: RuntimeException) {
        // The failed frame may never produce a result: free everything in flight.
        s.tracker.clear().forEach { s.pool.release(it.payload.bitmap) }
        if (session === s && s.active) {
            s.stats.errors.incrementAndGet()
            reportError(s, "E_INFERENCE", e.message ?: e.javaClass.simpleName)
        }
    }

    // --------------------------------------------------------------------- events

    private fun reportError(s: Session, code: String, message: String) {
        s.stats.errors.incrementAndGet()
        emitState(s, "error", code, message)
    }

    private fun emitState(s: Session, state: String, code: String, message: String) {
        val map = Arguments.createMap()
        map.putInt("sessionId", s.id)
        map.putString("state", state)
        map.putString("code", code)
        map.putString("message", message)
        map.putString("delegate", s.delegateName)
        try {
            sink.onState(map)
        } catch (_: Throwable) {
            // The React instance may already be gone during teardown.
        }
    }
}
