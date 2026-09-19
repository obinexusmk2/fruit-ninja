package com.fruitninja.hands.core

/** Fixed-size window of recent samples with average and percentile. Thread-safe. */
class RollingStats(private val capacity: Int) {
    private val values = DoubleArray(capacity)
    private var count = 0
    private var next = 0

    init {
        require(capacity > 0) { "capacity must be > 0" }
    }

    @Synchronized
    fun add(v: Double) {
        values[next] = v
        next = (next + 1) % capacity
        if (count < capacity) count++
    }

    @Synchronized
    fun average(): Double {
        if (count == 0) return 0.0
        var sum = 0.0
        for (i in 0 until count) sum += values[i]
        return sum / count
    }

    /** Nearest-rank percentile, p in [0, 100]. */
    @Synchronized
    fun percentile(p: Double): Double {
        if (count == 0) return 0.0
        val copy = values.copyOf(count)
        copy.sort()
        val rank = Math.ceil(p / 100.0 * count).toInt().coerceIn(1, count)
        return copy[rank - 1]
    }

    @Synchronized
    fun clear() {
        count = 0
        next = 0
    }
}
