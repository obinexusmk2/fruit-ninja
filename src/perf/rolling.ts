/** Fixed-window sample store with average / percentile / count. */
export class RollingStats {
  private values: number[] = [];
  private total = 0;

  constructor(private readonly capacity = 600) {}

  add(v: number): void {
    if (!Number.isFinite(v)) {
      return;
    }
    this.values.push(v);
    this.total++;
    if (this.values.length > this.capacity) {
      this.values.shift();
    }
  }

  /** Samples currently in the window. */
  get count(): number {
    return this.values.length;
  }

  /** Samples ever added (window included). */
  get lifetimeCount(): number {
    return this.total;
  }

  average(): number {
    if (this.values.length === 0) {
      return 0;
    }
    let sum = 0;
    for (const v of this.values) {
      sum += v;
    }
    return sum / this.values.length;
  }

  /** Nearest-rank percentile, p in [0, 100]. */
  percentile(p: number): number {
    if (this.values.length === 0) {
      return 0;
    }
    const sorted = [...this.values].sort((a, b) => a - b);
    const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
    return sorted[rank - 1]!;
  }

  max(): number {
    return this.values.length === 0 ? 0 : Math.max(...this.values);
  }

  clear(): void {
    this.values = [];
  }
}
