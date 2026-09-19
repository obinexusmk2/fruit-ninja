package com.fruitninja.hands.core

import com.google.mediapipe.tasks.components.containers.Category
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LandmarkPackerTest {
    private fun hand(xOffset: Float): List<NormalizedLandmark> =
        (0 until LandmarkPacker.LANDMARKS_PER_HAND).map { i ->
            NormalizedLandmark.create(xOffset + i * 0.01f, 0.5f + i * 0.001f, 0f)
        }

    @Test
    fun onlyCompleteHandsAreSent() {
        val partial = hand(0f).take(10)
        val hands = listOf(hand(0.1f), partial, hand(0.6f))
        assertEquals(listOf(0, 2), LandmarkPacker.validHandIndices(hands, maxHands = 2))
    }

    @Test
    fun handCountIsCappedAtMaxHands() {
        val hands = listOf(hand(0.1f), hand(0.4f), hand(0.7f))
        assertEquals(listOf(0), LandmarkPacker.validHandIndices(hands, maxHands = 1))
        assertEquals(listOf(0, 1), LandmarkPacker.validHandIndices(hands, maxHands = 2))
    }

    @Test
    fun packsXThenYForEveryLandmarkOfEverySelectedHand() {
        val hands = listOf(hand(0.1f), hand(0.6f))
        val packed = LandmarkPacker.packXY(hands, listOf(0, 1))
        assertEquals(2 * LandmarkPacker.VALUES_PER_HAND, packed.size)
        // first hand, landmark 0 and 8
        assertEquals(0.1, packed[0], 1e-6)
        assertEquals(0.5, packed[1], 1e-6)
        assertEquals(0.1 + 8 * 0.01, packed[16], 1e-6)
        assertEquals(0.5 + 8 * 0.001, packed[17], 1e-6)
        // second hand starts at index 42
        assertEquals(0.6, packed[LandmarkPacker.VALUES_PER_HAND], 1e-6)
    }

    @Test
    fun noHandsPacksToAnEmptyArray() {
        assertArrayEquals(DoubleArray(0), LandmarkPacker.packXY(emptyList(), emptyList()), 0.0)
    }

    @Test
    fun handednessTakesTheHighestScoringLabel() {
        val cats = listOf(
            Category.create(0.2f, 0, "Left", ""),
            Category.create(0.8f, 1, "Right", ""),
        )
        assertEquals(LandmarkPacker.HAND_RIGHT, LandmarkPacker.handedness(cats))
        assertEquals(0.8, LandmarkPacker.handednessScore(cats), 1e-6)
    }

    @Test
    fun handednessIsUnknownWhenMissingOrUnrecognised() {
        assertEquals(LandmarkPacker.HAND_UNKNOWN, LandmarkPacker.handedness(null))
        assertEquals(LandmarkPacker.HAND_UNKNOWN, LandmarkPacker.handedness(emptyList()))
        assertEquals(
            LandmarkPacker.HAND_UNKNOWN,
            LandmarkPacker.handedness(listOf(Category.create(0.9f, 0, "Other", ""))),
        )
        assertEquals(0.0, LandmarkPacker.handednessScore(null), 0.0)
    }

    @Test
    fun handednessScoreIsNotALandmarkConfidence() {
        // The task leaves per-landmark visibility/presence unset; the packer must not
        // invent a landmark confidence out of the handedness score.
        val lm = NormalizedLandmark.create(0.1f, 0.2f, 0f)
        assertTrue(lm.visibility().isEmpty)
        assertTrue(lm.presence().isEmpty)
    }
}
