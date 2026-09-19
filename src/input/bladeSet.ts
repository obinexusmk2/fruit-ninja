import {
  beginStroke,
  createTrail,
  endStroke,
  extendStroke,
  pruneTrail,
  type ExtendResult,
} from '../game/trail';
import type {BladeTrail} from '../game/types';
import {BLADE_COLORS, type InputMode} from './types';

export interface BladeSetOptions {
  maxPoints: number;
  /** Gap between samples after which a stroke is restarted instead of bridged. */
  gapMs: number;
  /** Drawn-trail lifetime; older points are pruned. */
  visualTtlMs: number;
}

/**
 * The two blade trails shared by input adapters, the simulation and the
 * renderer.
 *
 * Ownership: only the input mode that has `claim()`ed the set may write to it.
 * A late callback from another mode (for example a camera result arriving
 * after the player switched to touch) is dropped, so two sources can never
 * interleave samples on one blade.
 */
export class BladeSet {
  readonly trails: BladeTrail[];
  private owner: InputMode | null = null;

  constructor(private readonly options: BladeSetOptions, slots = 2) {
    this.trails = [];
    for (let i = 0; i < slots; i++) {
      this.trails.push(createTrail(i, BLADE_COLORS[i] ?? '#FFFFFF'));
    }
  }

  getOwner(): InputMode | null {
    return this.owner;
  }

  /** Makes `mode` the sole writer. Switching owner clears every trail. */
  claim(mode: InputMode): void {
    if (this.owner !== mode) {
      this.clear();
      this.owner = mode;
    }
  }

  /** Sets the owner directly (null = nobody). A change clears every trail. */
  setOwner(mode: InputMode | null): void {
    if (this.owner !== mode) {
      this.clear();
      this.owner = mode;
    }
  }

  /** Releases ownership (and the trails) if `mode` currently holds it. */
  release(mode: InputMode): void {
    if (this.owner === mode) {
      this.clear();
      this.owner = null;
    }
  }

  /** Starts a new stroke on `slot`. Returns false if `mode` is not the owner. */
  begin(mode: InputMode, slot: number, x: number, y: number, t: number): boolean {
    const trail = this.trails[slot];
    if (mode !== this.owner || !trail) {
      return false;
    }
    beginStroke(trail, x, y, t);
    return true;
  }

  extend(
    mode: InputMode,
    slot: number,
    x: number,
    y: number,
    t: number,
  ): ExtendResult | 'not-owner' {
    const trail = this.trails[slot];
    if (mode !== this.owner || !trail) {
      return 'not-owner';
    }
    return extendStroke(trail, x, y, t, this.options.maxPoints, this.options.gapMs);
  }

  /** Ends and clears the stroke on `slot` immediately. */
  end(mode: InputMode, slot: number): void {
    const trail = this.trails[slot];
    if (mode === this.owner && trail) {
      endStroke(trail);
    }
  }

  clear(): void {
    for (const t of this.trails) {
      endStroke(t);
    }
  }

  prune(nowMs: number): void {
    for (const t of this.trails) {
      pruneTrail(t, nowMs, this.options.visualTtlMs);
    }
  }
}
