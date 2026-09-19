import type {FruitEntity} from './types';
import {POOL_SIZE} from './constants';

let nextId = 0;

function makeFruitEntity(): FruitEntity {
  return {
    id: nextId++,
    kind: 'apple',
    state: 'inactive',
    x: 0, y: 0, vx: 0, vy: 0,
    rotation: 0, rotationSpeed: 0,
    half1x: 0, half1y: 0, half1vx: 0, half1vy: 0, half1rot: 0,
    half2x: 0, half2y: 0, half2vx: 0, half2vy: 0, half2rot: 0,
    splashX: 0, splashY: 0, splashTimer: 0,
    active: false,
  };
}

function resetFruitEntity(e: FruitEntity): void {
  e.state = 'inactive';
  e.active = false;
  e.kind = 'apple';
  e.x = 0; e.y = 0; e.vx = 0; e.vy = 0;
  e.rotation = 0; e.rotationSpeed = 0;
  e.half1x = 0; e.half1y = 0; e.half1vx = 0; e.half1vy = 0; e.half1rot = 0;
  e.half2x = 0; e.half2y = 0; e.half2vx = 0; e.half2vy = 0; e.half2rot = 0;
  e.splashX = 0; e.splashY = 0; e.splashTimer = 0;
}

/**
 * Fixed-capacity entity pool. `acquire()` returns null when every slot is in
 * use (pool exhaustion); callers must handle that instead of allocating.
 */
export class FruitPool {
  private pool: FruitEntity[] = [];

  constructor(readonly capacity: number = POOL_SIZE) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push(makeFruitEntity());
    }
  }

  acquire(): FruitEntity | null {
    for (const e of this.pool) {
      if (!e.active) {
        e.active = true;
        return e;
      }
    }
    return null;
  }

  release(e: FruitEntity): void {
    resetFruitEntity(e);
  }

  /** Releases every entity (new game). */
  releaseAll(): void {
    for (const e of this.pool) {
      if (e.active) {
        resetFruitEntity(e);
      }
    }
  }

  forEachActive(cb: (e: FruitEntity) => void): void {
    for (const e of this.pool) {
      if (e.active) {
        cb(e);
      }
    }
  }

  /** Backing array for allocation-free iteration; check `active` yourself. */
  entities(): readonly FruitEntity[] {
    return this.pool;
  }

  activeCount(): number {
    let n = 0;
    for (const e of this.pool) {
      if (e.active) {
        n++;
      }
    }
    return n;
  }

  activeEntities(): FruitEntity[] {
    return this.pool.filter(e => e.active);
  }
}
