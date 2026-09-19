import {GameSimulation} from '../../src/game/simulation';
import {mulberry32} from '../../src/game/rng';
import {beginStroke, createTrail, extendStroke} from '../../src/game/trail';
import type {GameTuning, Viewport} from '../../src/game/config';
import type {BladeTrail, EntityKind, FruitEntity} from '../../src/game/types';

export const PHONE: Viewport = {width: 360, height: 800};

/** A simulation with no automatic spawns unless a test asks for them. */
export function makeSim(
  opts: {viewport?: Viewport; overrides?: GameTuning; seed?: number} = {},
) {
  const blades: BladeTrail[] = [createTrail(0, '#00FFFF'), createTrail(1, '#FF6600')];
  const sim = new GameSimulation(
    opts.viewport ?? PHONE,
    blades,
    mulberry32(opts.seed ?? 1234),
    {firstSpawnDelayMs: 1e12, ...opts.overrides},
  );
  return {sim, blades};
}

export function placeFruit(
  sim: GameSimulation,
  p: {x: number; y: number; vx?: number; vy?: number; kind?: EntityKind},
): FruitEntity {
  const e = sim.pool.acquire();
  if (!e) {
    throw new Error('test setup: pool exhausted');
  }
  e.kind = p.kind ?? 'apple';
  e.state = 'whole';
  e.x = p.x;
  e.y = p.y;
  e.vx = p.vx ?? 0;
  e.vy = p.vy ?? 0;
  e.rotation = 0;
  e.rotationSpeed = 0;
  e.splashTimer = 0;
  return e;
}

/** Draws a two-sample stroke (a single swipe segment) on a trail. */
export function swipe(
  trail: BladeTrail,
  from: {x: number; y: number},
  to: {x: number; y: number},
  t0: number,
  t1: number,
): void {
  beginStroke(trail, from.x, from.y, t0);
  extendStroke(trail, to.x, to.y, t1, 20, 200);
}

/**
 * Drives the simulation at a display refresh rate for `durationMs` of virtual
 * time. Returns the total fixed steps executed.
 */
export function runAtHz(
  sim: GameSimulation,
  hz: number,
  durationMs: number,
  startNowMs = 0,
): number {
  const frame = 1000 / hz;
  const frames = Math.round(durationMs / frame);
  let steps = 0;
  for (let i = 1; i <= frames; i++) {
    steps += sim.advance(frame, startNowMs + i * frame);
  }
  return steps;
}
