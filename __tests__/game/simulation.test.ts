import {GameSimulation} from '../../src/game/simulation';
import {createGameConfig} from '../../src/game/config';
import {FruitPool} from '../../src/game/objectPool';
import {spawnFruit} from '../../src/game/fruitSpawner';
import {mulberry32} from '../../src/game/rng';
import {createTrail} from '../../src/game/trail';
import type {SimEvent} from '../../src/game/types';
import {PHONE, makeSim, placeFruit, runAtHz, swipe} from './helpers';

const FRAME = 1000 / 60;

/** One frame of the simulation with the blade "now" set to `now`. */
const frame = (sim: GameSimulation, now: number) => sim.advance(FRAME, now);
const events = (sim: GameSimulation, type: SimEvent['type']) =>
  sim.drainEvents().filter(e => e.type === type);

describe('scoring', () => {
  test('slicing a fruit scores exactly one point', () => {
    const {sim, blades} = makeSim();
    const f = placeFruit(sim, {x: 180, y: 400});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    frame(sim, 10);
    expect(sim.state.score).toBe(1);
    expect(f.state).toBe('sliced');
    expect(sim.state.lives).toBe(3);
  });

  test('a fruit crossed by BOTH blades in the same update scores once', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: 400});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    swipe(blades[1]!, {x: 180, y: 320}, {x: 180, y: 480}, 0, 10);
    frame(sim, 10);
    expect(sim.state.score).toBe(1);
    const slices = events(sim, 'slice');
    expect(slices).toHaveLength(1);
    // Slot order is deterministic: blade 0 wins.
    expect((slices[0] as Extract<SimEvent, {type: 'slice'}>).slot).toBe(0);
  });

  test('two different fruit sliced in one update score two', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 120, y: 400});
    placeFruit(sim, {x: 240, y: 400});
    swipe(blades[0]!, {x: 60, y: 400}, {x: 300, y: 400}, 0, 10);
    frame(sim, 10);
    expect(sim.state.score).toBe(2);
  });

  test('a fruit that has already been sliced cannot score again', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: 400});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    frame(sim, 10);
    frame(sim, 20);
    frame(sim, 30);
    expect(sim.state.score).toBe(1);
  });

  test('a stationary or expired blade does not slice fruit that drifts into it', () => {
    const {sim, blades} = makeSim();
    // Swipe happened long ago (sample time 0), fruit arrives at t = 1000 ms.
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    placeFruit(sim, {x: 180, y: 400});
    frame(sim, 1000);
    expect(sim.state.score).toBe(0);
  });
});

describe('lives and missed fruit', () => {
  const H = PHONE.height;
  const cull = () => createGameConfig(PHONE).cullMargin;

  test('a fruit that falls out of the playable area costs one life', () => {
    const {sim} = makeSim();
    placeFruit(sim, {x: 180, y: H + cull() + 5, vy: 200});
    frame(sim, 0);
    expect(sim.state.lives).toBe(2);
    expect(events(sim, 'miss')).toHaveLength(1);
    expect(sim.pool.activeCount()).toBe(0);
  });

  test('a BOMB that falls out of the playable area costs nothing (regression)', () => {
    const {sim} = makeSim();
    placeFruit(sim, {x: 180, y: H + cull() + 5, vy: 200, kind: 'bomb'});
    frame(sim, 0);
    expect(sim.state.lives).toBe(3);
    expect(sim.state.phase).toBe('running');
    expect(events(sim, 'miss')).toHaveLength(0);
    expect(sim.pool.activeCount()).toBe(0);
  });

  test('losing the last life ends the game with reason "lives"', () => {
    const {sim} = makeSim();
    sim.state.lives = 1;
    placeFruit(sim, {x: 180, y: H + cull() + 5, vy: 200});
    frame(sim, 0);
    expect(sim.state.lives).toBe(0);
    expect(sim.state.phase).toBe('gameover');
    expect(sim.state.gameOverReason).toBe('lives');
  });

  test('two fruit missed in the same step never push lives below zero and end once', () => {
    const {sim} = makeSim();
    sim.state.lives = 1;
    placeFruit(sim, {x: 100, y: H + cull() + 5, vy: 200});
    placeFruit(sim, {x: 200, y: H + cull() + 5, vy: 200});
    frame(sim, 0);
    expect(sim.state.lives).toBe(0);
    expect(events(sim, 'gameover')).toHaveLength(1);
  });

  test('a fruit that is sliced is not also counted as missed', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: H + cull() + 5, vy: 200});
    swipe(blades[0]!, {x: 100, y: H + cull() + 5}, {x: 260, y: H + cull() + 5}, 0, 10);
    frame(sim, 10);
    expect(sim.state.lives).toBe(3);
    expect(sim.state.score).toBe(1);
  });
});

describe('bombs and the single terminal transition', () => {
  test('slicing a bomb ends the game immediately with reason "bomb"', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: 400, kind: 'bomb'});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    frame(sim, 10);
    expect(sim.state.phase).toBe('gameover');
    expect(sim.state.gameOverReason).toBe('bomb');
  });

  test('two bombs sliced in the same update produce exactly one game-over (regression)', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 150, y: 400, kind: 'bomb'});
    placeFruit(sim, {x: 210, y: 400, kind: 'bomb'});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    swipe(blades[1]!, {x: 100, y: 405}, {x: 260, y: 405}, 0, 10);
    frame(sim, 10);
    const all = sim.drainEvents();
    expect(all.filter(e => e.type === 'gameover')).toHaveLength(1);
    expect(all.filter(e => e.type === 'bomb')).toHaveLength(1);
  });

  test('bombs win ties: fruit sliced in the same update as a bomb award no score', () => {
    const {sim, blades} = makeSim();
    // The fruit is earlier in pool order than the bomb.
    const fruit = placeFruit(sim, {x: 120, y: 400});
    placeFruit(sim, {x: 240, y: 400, kind: 'bomb'});
    swipe(blades[0]!, {x: 60, y: 400}, {x: 300, y: 400}, 0, 10);
    frame(sim, 10);
    expect(sim.state.phase).toBe('gameover');
    expect(sim.state.score).toBe(0);
    expect(fruit.state).toBe('whole');
  });

  test('nothing changes after game over: no advance, no score, no lives', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: 400, kind: 'bomb'});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    frame(sim, 10);
    sim.drainEvents();

    const f = placeFruit(sim, {x: 180, y: 300});
    swipe(blades[1]!, {x: 100, y: 300}, {x: 260, y: 300}, 20, 30);
    expect(sim.advance(FRAME, 30)).toBe(0);
    expect(sim.state.score).toBe(0);
    expect(f.state).toBe('whole');
    expect(sim.drainEvents()).toEqual([]);
  });

  test('reset() starts a clean game', () => {
    const {sim, blades} = makeSim();
    placeFruit(sim, {x: 180, y: 400, kind: 'bomb'});
    swipe(blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    frame(sim, 10);
    sim.reset();
    expect(sim.state).toEqual({
      score: 0,
      lives: 3,
      phase: 'running',
      gameOverReason: null,
      droppedSpawns: 0,
    });
    expect(sim.pool.activeCount()).toBe(0);
    expect(sim.drainEvents()).toEqual([]);
  });
});

describe('object pool exhaustion', () => {
  test('acquire returns null when every slot is in use and recovers after release', () => {
    const pool = new FruitPool(3);
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect([a, b, c].every(Boolean)).toBe(true);
    expect(pool.acquire()).toBeNull();
    pool.release(b!);
    expect(pool.acquire()).toBe(b);
    expect(pool.activeCount()).toBe(3);
  });

  test('released entities are fully reset for reuse', () => {
    const pool = new FruitPool(1);
    const e = pool.acquire()!;
    e.kind = 'bomb';
    e.state = 'sliced';
    e.x = 5;
    e.half1x = 9;
    e.splashTimer = 99;
    pool.release(e);
    expect(e).toMatchObject({
      active: false,
      state: 'inactive',
      kind: 'apple',
      x: 0,
      half1x: 0,
      splashTimer: 0,
    });
  });

  test('spawnFruit reports exhaustion without throwing or over-allocating', () => {
    const config = createGameConfig(PHONE);
    const pool = new FruitPool(2);
    const rng = mulberry32(7);
    expect(spawnFruit(pool, config, rng)).not.toBeNull();
    expect(spawnFruit(pool, config, rng)).not.toBeNull();
    expect(spawnFruit(pool, config, rng)).toBeNull();
    expect(pool.activeCount()).toBe(2);
  });

  test('the simulation counts spawns it had to drop when the pool is full', () => {
    const {sim} = makeSim({
      overrides: {
        poolSize: 2,
        firstSpawnDelayMs: 1,
        spawnBurstMin: 3,
        spawnBurstMax: 3,
      },
    });
    expect(() => frame(sim, 0)).not.toThrow();
    expect(sim.pool.activeCount()).toBe(2);
    expect(sim.state.droppedSpawns).toBe(1);
  });
});

describe('time consistency across display refresh rates', () => {
  const TEN_SECONDS = 10_000;
  const expectedSteps = Math.round(TEN_SECONDS / (1000 / 120));

  function physicsRun(hz: number) {
    // Unlimited lives so the game does not end (missed fruit) inside the window.
    const {sim} = makeSim({
      seed: 99,
      overrides: {firstSpawnDelayMs: 300, bombChance: 0, livesStart: 1_000_000},
    });
    const steps = runAtHz(sim, hz, TEN_SECONDS);
    return {sim, steps};
  }

  test.each([30, 60, 120])('%d Hz executes the same number of fixed steps', hz => {
    expect(physicsRun(hz).steps).toBe(expectedSteps);
  });

  test('entity trajectories are identical at 30, 60 and 120 Hz', () => {
    const runs = [30, 60, 120].map(hz => physicsRun(hz).sim);
    const snapshot = (s: GameSimulation) =>
      s.pool
        .activeEntities()
        .map(e => ({id: e.id, kind: e.kind, x: e.x, y: e.y, state: e.state}))
        .sort((a, b) => a.id - b.id);
    const base = snapshot(runs[0]!);
    expect(base.length).toBeGreaterThan(0);
    for (const other of runs.slice(1)) {
      const snap = snapshot(other);
      expect(snap).toHaveLength(base.length);
      snap.forEach((s, i) => {
        expect(s.kind).toBe(base[i]!.kind);
        expect(s.x).toBeCloseTo(base[i]!.x, 6);
        expect(s.y).toBeCloseTo(base[i]!.y, 6);
      });
    }
    // Same lives lost regardless of refresh rate.
    expect(runs[1]!.state.lives).toBe(runs[0]!.state.lives);
    expect(runs[2]!.state.lives).toBe(runs[0]!.state.lives);
  });

  test('a time-stamped swipe slices the same fruit at every refresh rate', () => {
    const outcomes = [30, 60, 120].map(hz => {
      const {sim, blades} = makeSim();
      placeFruit(sim, {x: 180, y: 400});
      const frameMs = 1000 / hz;
      // A continuous swipe from x=60..300 over 80 ms, sampled at 240 Hz.
      const samples: Array<[number, number, number]> = [];
      for (let i = 0; i <= 20; i++) {
        samples.push([60 + i * 12, 400, 100 + i * 4]);
      }
      let next = 0;
      for (let now = frameMs; now <= 500; now += frameMs) {
        while (next < samples.length && samples[next]![2] <= now) {
          const [x, y, t] = samples[next]!;
          const trail = blades[0]!;
          if (next === 0) {
            trail.points.length = 0;
            trail.points.push({x, y, t});
            trail.active = true;
          } else {
            trail.points.push({x, y, t});
          }
          next++;
        }
        sim.advance(frameMs, now);
      }
      return sim.state.score;
    });
    expect(outcomes).toEqual([1, 1, 1]);
  });

  test('a long stall is clamped and bounded instead of fast-forwarding', () => {
    const {sim} = makeSim();
    const cfg = sim.getConfig();
    const steps = sim.advance(5000, 0);
    expect(steps).toBeLessThanOrEqual(cfg.maxStepsPerAdvance);
    expect(steps).toBe(Math.floor(cfg.maxFrameDeltaMs / cfg.fixedStepMs));
  });

  test('invalid frame deltas are ignored', () => {
    const {sim} = makeSim();
    for (const d of [NaN, -16, 0, Infinity, undefined as unknown as number]) {
      const before = sim.pool.activeCount();
      expect(sim.advance(d, 0)).toBe(0);
      expect(sim.pool.activeCount()).toBe(before);
    }
  });

  test('resetTiming discards accumulated partial time', () => {
    const {sim} = makeSim();
    const step = sim.getConfig().fixedStepMs;
    sim.advance(step * 0.9, 0); // nearly a step banked
    sim.resetTiming();
    expect(sim.advance(step * 0.2, 0)).toBe(0); // would have been a step without the reset
  });
});

describe('scaling to the playable area', () => {
  const sizes = [
    {name: 'small phone', width: 320, height: 640},
    {name: 'large phone', width: 412, height: 915},
    {name: 'tablet portrait', width: 800, height: 1280},
    {name: 'tablet landscape', width: 1280, height: 800},
  ];

  test.each(sizes)('$name: launched fruit peak inside the screen', ({width, height}) => {
    const {sim} = makeSim({viewport: {width, height}, overrides: {bombChance: 0}});
    const cfg = sim.getConfig();
    const rng = mulberry32(5);
    for (let n = 0; n < 40; n++) {
      const e = spawnFruit(sim.pool, cfg, rng)!;
      const startY = e.y;
      // Apex of a ballistic arc: v^2 / (2 g) above the launch point.
      const apex = (e.vy * e.vy) / (2 * cfg.gravity);
      expect(apex).toBeGreaterThanOrEqual(cfg.apexMin - 1e-6);
      expect(apex).toBeLessThanOrEqual(cfg.apexMax + 1e-6);
      expect(startY - apex).toBeGreaterThan(0); // never leaves through the top
      expect(e.x).toBeGreaterThanOrEqual(width * 0.1 - 1e-6);
      expect(e.x).toBeLessThanOrEqual(width * 0.9 + 1e-6);
      sim.pool.release(e);
    }
  });

  test('target size scales with the screen but is clamped', () => {
    const small = createGameConfig({width: 320, height: 640});
    const tablet = createGameConfig({width: 800, height: 1280});
    const huge = createGameConfig({width: 3000, height: 4000});
    expect(tablet.fruitRadius).toBeGreaterThan(small.fruitRadius);
    expect(huge.fruitRadius).toBeCloseTo(0.115 * 900, 6);
    expect(small.bombRadius).toBeLessThan(small.fruitRadius);
  });

  test('a fruit takes the same time to fly on different screen heights', () => {
    const flight = (height: number) => {
      const cfg = createGameConfig({width: 360, height});
      const apex = (cfg.apexMin + cfg.apexMax) / 2;
      const v = Math.sqrt(2 * cfg.gravity * apex);
      return (2 * v) / cfg.gravity; // seconds up and back down to the launch height
    };
    expect(flight(640)).toBeCloseTo(flight(1280), 6);
  });

  test('resize keeps entities finite and proportionally placed', () => {
    const {sim} = makeSim();
    const e = placeFruit(sim, {x: 180, y: 400, vx: 20, vy: -50});
    sim.resize({width: 720, height: 1600});
    expect(e.x).toBeCloseTo(360, 6);
    expect(e.y).toBeCloseTo(800, 6);
    expect(e.vx).toBeCloseTo(40, 6);
    expect(e.vy).toBeCloseTo(-100, 6);
    expect(sim.getConfig().viewport).toEqual({width: 720, height: 1600});
    expect(() => sim.advance(FRAME, 0)).not.toThrow();
    expect(Number.isFinite(e.y)).toBe(true);
  });
});

describe('full automatic play', () => {
  test('a game with no input runs, spawns fruit and ends by lives without error', () => {
    const {sim} = makeSim({seed: 42, overrides: {firstSpawnDelayMs: 200}});
    const seen: SimEvent[] = [];
    for (let i = 0; i < 60 * 60 && sim.state.phase === 'running'; i++) {
      sim.advance(FRAME, i * FRAME);
      seen.push(...sim.drainEvents());
    }
    expect(sim.state.phase).toBe('gameover');
    expect(sim.state.gameOverReason).toBe('lives');
    expect(seen.filter(e => e.type === 'gameover')).toHaveLength(1);
    expect(sim.state.lives).toBe(0);
    expect(sim.state.score).toBe(0);
    expect(createTrail(0, '#0ff').points).toEqual([]);
  });
});
