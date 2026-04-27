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
  e.splashTimer = 0;
}

export class FruitPool {
  private pool: FruitEntity[] = [];

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
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

  forEachActive(cb: (e: FruitEntity) => void): void {
    for (const e of this.pool) {
      if (e.active) cb(e);
    }
  }

  activeEntities(): FruitEntity[] {
    return this.pool.filter(e => e.active);
  }
}
