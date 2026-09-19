import type {BladeSet} from './bladeSet';
import type {BladeCount} from './types';

export interface TouchPoint {
  /** Stable pointer identifier supplied by the OS (not the array index). */
  id: number;
  /** Coordinates local to the game canvas (not page/screen coordinates). */
  x: number;
  y: number;
}

export type TouchPhase = 'start' | 'move' | 'end' | 'cancel';

export interface TouchInput {
  phase: TouchPhase;
  /** Only the pointers that changed in this event. */
  changed: readonly TouchPoint[];
  /** Sample time on the shared monotonic clock. */
  t: number;
}

/**
 * Maps touch pointers to blades by their stable pointer id.
 *
 * Reordering of the OS touch array, a finger lifting while another is down, or
 * a third finger arriving never re-assigns a blade to a different finger: each
 * pointer keeps its own slot from touch-down to touch-up. Pointers beyond the
 * available blades are ignored.
 */
export class TouchAdapter {
  private readonly idToSlot = new Map<number, number>();

  constructor(
    private readonly blades: BladeSet,
    private bladeCount: BladeCount = 2,
  ) {}

  setBladeCount(count: BladeCount): void {
    this.bladeCount = count;
    this.cancelAll();
  }

  /**
   * Applies a touch event. The adapter never claims the blades itself: the
   * session decides which mode owns them, and writes from a non-owner are
   * rejected by the BladeSet (so a stray touch cannot steal hand-mode blades).
   */
  handle(input: TouchInput): void {
    for (const p of input.changed) {
      switch (input.phase) {
        case 'start':
          this.start(p, input.t);
          break;
        case 'move':
          this.move(p, input.t);
          break;
        case 'end':
        case 'cancel':
          this.stop(p);
          break;
      }
    }
  }

  /** Ends every active touch stroke (pause, background, screen change). */
  cancelAll(): void {
    for (const slot of this.idToSlot.values()) {
      this.blades.end('touch', slot);
    }
    this.idToSlot.clear();
  }

  private freeSlot(): number {
    const used = new Set(this.idToSlot.values());
    for (let s = 0; s < this.bladeCount; s++) {
      if (!used.has(s)) {
        return s;
      }
    }
    return -1;
  }

  private start(p: {id: number; x: number; y: number}, t: number): void {
    const existing = this.idToSlot.get(p.id);
    if (existing !== undefined) {
      // A repeated down for a live pointer restarts its stroke.
      this.blades.begin('touch', existing, p.x, p.y, t);
      return;
    }
    const slot = this.freeSlot();
    if (slot < 0) {
      return;
    }
    if (this.blades.begin('touch', slot, p.x, p.y, t)) {
      this.idToSlot.set(p.id, slot);
    }
  }

  private move(p: {id: number; x: number; y: number}, t: number): void {
    const slot = this.idToSlot.get(p.id);
    if (slot !== undefined) {
      this.blades.extend('touch', slot, p.x, p.y, t);
    }
  }

  private stop(p: {id: number}): void {
    const slot = this.idToSlot.get(p.id);
    if (slot !== undefined) {
      this.blades.end('touch', slot);
      this.idToSlot.delete(p.id);
    }
  }
}
