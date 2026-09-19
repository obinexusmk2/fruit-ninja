package com.fruitninja.hands.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InFlightTrackerTest {
    private var now = 0L
    private fun tracker(max: Int, timeout: Long = 1000) =
        InFlightTracker<String>(max, timeout) { now }

    @Test
    fun capacityIsBoundedAndFreesOnCompletion() {
        val t = tracker(1)
        assertTrue(t.tryAdd(10, "frame-10"))
        assertFalse("a second frame must not be admitted while one is in flight", t.tryAdd(20, "frame-20"))
        assertFalse(t.hasCapacity())

        val done = t.complete(10)
        assertEquals("frame-10", done.matched?.payload)
        assertTrue(done.droppedOlder.isEmpty())
        assertTrue(t.hasCapacity())
        assertTrue(t.tryAdd(20, "frame-20"))
    }

    @Test
    fun twoInFlightWhenConfiguredForTwo() {
        val t = tracker(2)
        assertTrue(t.tryAdd(1, "a"))
        assertTrue(t.tryAdd(2, "b"))
        assertFalse(t.tryAdd(3, "c"))
        assertEquals(2, t.size())
    }

    @Test
    fun aResultReleasesOlderFramesThatMediaPipeDropped() {
        val t = tracker(3)
        t.tryAdd(1, "a")
        t.tryAdd(2, "b")
        t.tryAdd(3, "c")
        // MediaPipe produced a result for frame 3 only: 1 and 2 were dropped inside the graph.
        val done = t.complete(3)
        assertEquals("c", done.matched?.payload)
        assertEquals(listOf("a", "b"), done.droppedOlder.map { it.payload })
        assertEquals(0, t.size()) // nothing leaks, so the pool cannot run dry
    }

    @Test
    fun aResultThatWasNeverSubmittedMatchesNothingAndReleasesNothingNewer() {
        val t = tracker(2)
        t.tryAdd(5, "e")
        val done = t.complete(4) // older than anything in flight
        assertNull(done.matched)
        assertTrue(done.droppedOlder.isEmpty())
        assertEquals(1, t.size())
    }

    @Test
    fun framesWhoseResultNeverArrivesAreExpired() {
        val t = tracker(1, timeout = 1000)
        t.tryAdd(1, "stuck")
        now = 999
        assertTrue(t.drainExpired().isEmpty())
        now = 1001
        val expired = t.drainExpired()
        assertEquals(listOf("stuck"), expired.map { it.payload })
        assertTrue("an expired entry frees its slot", t.hasCapacity())
    }

    @Test
    fun aSynchronouslyRejectedSubmissionCanBeRemoved() {
        val t = tracker(1)
        t.tryAdd(7, "x")
        assertNotNull(t.remove(7))
        assertNull(t.remove(7))
        assertTrue(t.hasCapacity())
    }

    @Test
    fun clearReleasesEverythingForTeardownOrDetectorErrors() {
        val t = tracker(3)
        t.tryAdd(1, "a")
        t.tryAdd(2, "b")
        assertEquals(listOf("a", "b"), t.clear().map { it.payload })
        assertEquals(0, t.size())
    }

    @Test(expected = IllegalArgumentException::class)
    fun aCapacityBelowOneIsRejected() {
        tracker(0)
    }
}
