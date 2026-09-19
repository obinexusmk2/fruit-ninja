package com.fruitninja.hands.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random

class MonotonicTimestampsTest {
    @Test
    fun increasingInputPassesThroughUnchanged() {
        val m = MonotonicTimestamps()
        assertEquals(100L, m.next(100))
        assertEquals(133L, m.next(133))
        assertEquals(1000L, m.next(1000))
    }

    @Test
    fun equalTimestampsAreBumpedByOneMillisecond() {
        val m = MonotonicTimestamps()
        assertEquals(500L, m.next(500))
        assertEquals(501L, m.next(500))
        assertEquals(502L, m.next(500))
    }

    @Test
    fun timestampsThatStepBackAreNeverReturned() {
        val m = MonotonicTimestamps()
        m.next(1000)
        val next = m.next(400) // e.g. a clock that appears to jump back across a camera restart
        assertTrue("must be strictly greater than 1000 but was $next", next > 1000)
    }

    @Test
    fun resetAllowsAFreshStream() {
        val m = MonotonicTimestamps()
        m.next(5_000)
        m.reset()
        assertEquals(10L, m.next(10))
    }

    @Test
    fun anyInputSequenceProducesAStrictlyIncreasingOutput() {
        val m = MonotonicTimestamps()
        val rnd = Random(42)
        var prev = Long.MIN_VALUE
        repeat(10_000) {
            val out = m.next(rnd.nextInt(2_000).toLong()) // heavy jitter, repeats and reversals
            assertTrue("$out was not > $prev", out > prev)
            prev = out
        }
    }
}
