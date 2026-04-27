import type {FruitPool} from './objectPool';
import type {FruitKind} from './types';
import {
  BOMB_CHANCE,
  FRUIT_KINDS,
  HALF_LATERAL_V,
  SPAWN_BURST_MAX,
  SPAWN_BURST_MIN,
  SPAWN_INTERVAL_MAX,
  SPAWN_INTERVAL_MIN,
} from './constants';

function rnd(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function spawnFruit(
  pool: FruitPool,
  screenW: number,
  screenH: number,
): void {
  const isBomb = Math.random() < BOMB_CHANCE;
  const kind: FruitKind | 'bomb' = isBomb
    ? 'bomb'
    : FRUIT_KINDS[Math.floor(Math.random() * FRUIT_KINDS.length)] ?? 'apple';

  const entity = pool.acquire();
  if (!entity) return;

  entity.kind = kind;
  entity.state = 'whole';
  entity.x = rnd(screenW * 0.1, screenW * 0.9);
  entity.y = screenH + 30;
  entity.vx = rnd(-HALF_LATERAL_V, HALF_LATERAL_V);
  entity.vy = rnd(-24, -18);
  entity.rotation = rnd(0, Math.PI * 2);
  entity.rotationSpeed = rnd(-0.1, 0.1);
  entity.splashTimer = 0;
}

export function nextSpawnInterval(): number {
  return Math.floor(rnd(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX));
}

export function burstCount(): number {
  return Math.floor(rnd(SPAWN_BURST_MIN, SPAWN_BURST_MAX + 1));
}
