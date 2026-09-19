package com.fruitninja.hands.core

import java.util.ArrayDeque

/**
 * Bounds the number of frames inside the detector and owns their backing
 * resources until each result (or a timeout) comes back.
 *
 * Why not just rely on CameraX back-pressure: `detectAsync` returns immediately,
 * so without this a slow detector would let frames pile up inside MediaPipe.
 * With [maxInFlight] = 1 the freshest frame is always the next one analysed.
 *
 * MediaPipe may drop a frame without producing a result. Results arrive in
 * timestamp order, so when a result for `ts` arrives every older entry is
 * treated as dropped and released too; entries older than [timeoutMs] are
 * purged. Together these make a leak (and so a deadlock) impossible.
 *
 * @param T the payload owned while in flight (e.g. a reusable bitmap)
 */
class InFlightTracker<T>(
    private val maxInFlight: Int,
    private val timeoutMs: Long,
    private val clockMs: () -> Long,
) {
    class Entry<T>(val timestampMs: Long, val submittedAtMs: Long, val payload: T)

    /** Outcome of [complete]. `matched` is null if the result was not expected. */
    class Completion<T>(val matched: Entry<T>?, val droppedOlder: List<Entry<T>>)

    private val entries = ArrayDeque<Entry<T>>()

    init {
        require(maxInFlight >= 1) { "maxInFlight must be >= 1" }
    }

    /** Removes and returns entries that have waited longer than the timeout. */
    @Synchronized
    fun drainExpired(): List<Entry<T>> {
        val now = clockMs()
        val expired = ArrayList<Entry<T>>()
        while (entries.isNotEmpty() && now - entries.first.submittedAtMs > timeoutMs) {
            expired.add(entries.removeFirst())
        }
        return expired
    }

    /** True if another frame may be submitted right now. */
    @Synchronized
    fun hasCapacity(): Boolean = entries.size < maxInFlight

    /** Registers a submitted frame. Returns false (and adds nothing) when full. */
    @Synchronized
    fun tryAdd(timestampMs: Long, payload: T): Boolean {
        if (entries.size >= maxInFlight) {
            return false
        }
        entries.addLast(Entry(timestampMs, clockMs(), payload))
        return true
    }

    /** Removes a submission that the detector rejected synchronously. */
    @Synchronized
    fun remove(timestampMs: Long): Entry<T>? {
        val it = entries.iterator()
        while (it.hasNext()) {
            val e = it.next()
            if (e.timestampMs == timestampMs) {
                it.remove()
                return e
            }
        }
        return null
    }

    @Synchronized
    fun complete(timestampMs: Long): Completion<T> {
        var matched: Entry<T>? = null
        val dropped = ArrayList<Entry<T>>()
        while (entries.isNotEmpty() && entries.first.timestampMs <= timestampMs) {
            val e = entries.removeFirst()
            if (e.timestampMs == timestampMs) matched = e else dropped.add(e)
        }
        return Completion(matched, dropped)
    }

    /** Releases everything (session teardown or a detector error). */
    @Synchronized
    fun clear(): List<Entry<T>> {
        val all = ArrayList(entries)
        entries.clear()
        return all
    }

    @Synchronized
    fun size(): Int = entries.size
}
