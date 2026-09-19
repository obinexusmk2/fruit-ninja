/**
 * Maps the native clock (Android elapsed-realtime, ms) onto the JavaScript clock
 * (performance.now, ms).
 *
 * The two clocks have different origins, so a fixed offset is estimated from
 * (receiveTime - nativeEmitTime) samples. Each sample is offset + transport
 * delay, and the delay is never negative, so the MINIMUM over a recent window is
 * the best estimate of the true offset (a min filter). Later, `toJs()` turns a
 * native frame time into JS time so its age can be compared with `now`.
 *
 * Limits: this cannot see the one-way delay of the fastest sample, so ages are
 * (true age - min transport delay). The hand pipeline reports ages measured this
 * way and documents that; it is not motion-to-photon latency.
 */
export class ClockSync {
  private samples: number[] = [];
  private offset: number | null = null;

  constructor(private readonly windowSize = 90) {}

  observe(nativeEmitMs: number, jsReceivedMs: number): void {
    if (!Number.isFinite(nativeEmitMs) || !Number.isFinite(jsReceivedMs)) {
      return;
    }
    this.samples.push(jsReceivedMs - nativeEmitMs);
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
    let min = Infinity;
    for (const s of this.samples) {
      if (s < min) {
        min = s;
      }
    }
    this.offset = min;
  }

  get ready(): boolean {
    return this.offset !== null;
  }

  /** Native time expressed on the JS clock (identity offset until the first sample). */
  toJs(nativeMs: number): number {
    return nativeMs + (this.offset ?? 0);
  }

  reset(): void {
    this.samples = [];
    this.offset = null;
  }
}
