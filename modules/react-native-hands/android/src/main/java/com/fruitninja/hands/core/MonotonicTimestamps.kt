package com.fruitninja.hands.core

/**
 * Strictly increasing millisecond timestamps.
 *
 * MediaPipe's live-stream mode (`detectAsync`) requires every timestamp on a
 * stream to be greater than the previous one. Camera frames can arrive within
 * the same millisecond or, across a camera restart, with a clock that appears to
 * step back, so raw times must never be passed through directly.
 */
class MonotonicTimestamps {
    private var last = Long.MIN_VALUE

    @Synchronized
    fun next(candidateMs: Long): Long {
        val value = if (candidateMs > last) candidateMs else last + 1
        last = value
        return value
    }

    @Synchronized
    fun reset() {
        last = Long.MIN_VALUE
    }
}
