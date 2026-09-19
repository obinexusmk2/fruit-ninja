package com.fruitninja.hands

import android.content.Context
import java.io.IOException
import java.security.MessageDigest

/**
 * Verifies the bundled hand_landmarker.task against the SHA-256 recorded next to
 * it (assets/hand_landmarker.task.sha256). The build fails on a mismatch too
 * (see the verifyHandLandmarkerModel Gradle task); this is the runtime check.
 */
object ModelIntegrity {
    const val CHECKSUM_ASSET = "hand_landmarker.task.sha256"

    data class Result(val present: Boolean, val sha256: String, val ok: Boolean)

    @Volatile
    private var cached: Result? = null

    fun check(context: Context): Result {
        cached?.let { return it }
        val assets = context.applicationContext.assets
        val result = try {
            val digest = MessageDigest.getInstance("SHA-256")
            assets.open(HandDetector.MODEL_ASSET).use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    digest.update(buffer, 0, n)
                }
            }
            val actual = digest.digest().joinToString("") { "%02x".format(it) }
            val expected = try {
                assets.open(CHECKSUM_ASSET).bufferedReader().use { it.readText() }
                    .trim().split(Regex("\\s+"))[0].lowercase()
            } catch (e: IOException) {
                ""
            }
            Result(present = true, sha256 = actual, ok = expected.isNotEmpty() && expected == actual)
        } catch (e: IOException) {
            Result(present = false, sha256 = "", ok = false)
        }
        cached = result
        return result
    }
}
