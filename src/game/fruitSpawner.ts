import type {FruitPool} from './objectPool';
import type {FruitEntity, FruitKind} from './types';
import type {GameConfig} from './config';
import {FRUIT_KINDS} from './constants';
import {randInt, randRange, type Rng} from './rng';

/**
 * Launches one fruit or bomb from below the viewport on a parabolic arc.
 * The launch speed is derived from a target apex height so the arc always fits
 * the playable area regardless of screen size: v = sqrt(2 * g * apex).
 * Returns null when the pool is exhausted.
 */
export function spawnFruit(
  pool: FruitPool,
  config: GameConfig,
  rng: Rng,
): FruitEntity | null {
  const isBomb = rng() < config.bombChance;
  const kind: FruitKind | 'bomb' = isBomb
    ? 'bomb'
    : FRUIT_KINDS[Math.floor(rng() * FRUIT_KINDS.length)] ?? 'apple';

  const entity = pool.acquire();
  if (!entity) {
    return null;
  }

  const {width, height} = config.viewport;
  const apex = randRange(rng, config.apexMin, config.apexMax);

  entity.kind = kind;
  entity.state = 'whole';
  entity.x = randRange(rng, width * 0.1, width * 0.9);
  entity.y = height + config.spawnMarginY;
  entity.vx = randRange(rng, -config.launchVx, config.launchVx);
  entity.vy = -Math.sqrt(2 * config.gravity * apex);
  entity.rotation = randRange(rng, 0, Math.PI * 2);
  entity.rotationSpeed = randRange(
    rng,
    -config.maxRotationSpeed,
    config.maxRotationSpeed,
  );
  entity.splashTimer = 0;
  return entity;
}

/** Milliseconds until the next spawn burst. */
export function nextSpawnDelay(config: GameConfig, rng: Rng): number {
  return randRange(rng, config.spawnIntervalMinMs, config.spawnIntervalMaxMs);
}

export function burstCount(config: GameConfig, rng: Rng): number {
  return randInt(rng, config.spawnBurstMin, config.spawnBurstMax);
}
