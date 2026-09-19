package com.fruitninja.hands.core

import org.junit.Assert.assertEquals
import org.junit.Test

class RollingStatsTest {
    @Test
    fun emptyStatsAreZero() {
        val s = RollingStats(10)
        assertEquals(0.0, s.average(), 0.0)
        assertEquals(0.0, s.percentile(95.0), 0.0)
    }

    @Test
    fun averageAndNearestRankPercentile() {
        val s = RollingStats(100)
        for (v in 1..100) s.add(v.toDouble())
        assertEquals(50.5, s.average(), 1e-9)
        assertEquals(95.0, s.percentile(95.0), 0.0)
        assertEquals(100.0, s.percentile(100.0), 0.0)
        assertEquals(1.0, s.percentile(1.0), 0.0)
    }

    @Test
    fun theWindowKeepsOnlyTheMostRecentSamples() {
        val s = RollingStats(3)
        for (v in listOf(1.0, 2.0, 3.0, 100.0, 200.0, 300.0)) s.add(v)
        assertEquals(200.0, s.average(), 1e-9) // 100, 200, 300
    }

    @Test
    fun clearEmptiesTheWindow() {
        val s = RollingStats(5)
        s.add(9.0)
        s.clear()
        assertEquals(0.0, s.average(), 0.0)
    }
}
