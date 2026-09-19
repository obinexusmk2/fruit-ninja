package com.fruitninja.hands.core

import com.google.mediapipe.tasks.components.containers.Category
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark

/**
 * Flattens MediaPipe hand results into small primitive arrays for the bridge.
 * Contains no Android or React Native types so it runs in plain JVM tests.
 */
object LandmarkPacker {
    const val LANDMARKS_PER_HAND = 21
    const val VALUES_PER_HAND = LANDMARKS_PER_HAND * 2

    const val HAND_LEFT = 0
    const val HAND_RIGHT = 1
    const val HAND_UNKNOWN = -1

    /** Hands that do not have exactly 21 landmarks are skipped, never partially sent. */
    fun validHandIndices(hands: List<List<NormalizedLandmark>>, maxHands: Int): List<Int> {
        val out = ArrayList<Int>(hands.size)
        for (i in hands.indices) {
            if (hands[i].size == LANDMARKS_PER_HAND && out.size < maxHands) {
                out.add(i)
            }
        }
        return out
    }

    /** x0,y0,x1,y1,... for each selected hand, in normalised upright-image coordinates. */
    fun packXY(hands: List<List<NormalizedLandmark>>, indices: List<Int>): DoubleArray {
        val out = DoubleArray(indices.size * VALUES_PER_HAND)
        var o = 0
        for (idx in indices) {
            for (lm in hands[idx]) {
                out[o++] = lm.x().toDouble()
                out[o++] = lm.y().toDouble()
            }
        }
        return out
    }

    /**
     * MediaPipe's handedness label for one hand (highest-scoring category).
     * This is a classifier output that can flip between frames and assumes a
     * mirrored image; it is reported as a hint only and is never an identity.
     */
    fun handedness(categories: List<Category>?): Int {
        val best = categories?.maxByOrNull { it.score() } ?: return HAND_UNKNOWN
        return when (best.categoryName().lowercase()) {
            "left" -> HAND_LEFT
            "right" -> HAND_RIGHT
            else -> HAND_UNKNOWN
        }
    }

    /** Score of the handedness label only. It says nothing about landmark accuracy. */
    fun handednessScore(categories: List<Category>?): Double =
        categories?.maxOfOrNull { it.score() }?.toDouble() ?: 0.0
}
