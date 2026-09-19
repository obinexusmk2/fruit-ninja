import {createGameConfig, difficultyTuning} from '../../src/game/config';
import {DIFFICULTY_RULES} from '../../src/game/constants';
import {beginStroke, extendStroke} from '../../src/game/trail';
import type {SimEvent} from '../../src/game/types';
import {PHONE, makeSim, placeFruit, runAtHz, swipe} from './helpers';

const FRAME = 1000 / 60;
const events = (sim: ReturnType<typeof makeSim>['sim'], type: SimEvent['type']) =>
  sim.drainEvents().filter(e => e.type === type);

/** Fruit spread along y=400 so ONE horizontal swipe crosses all of them. */
function fruitRow(sim: ReturnType<typeof makeSim>['sim'], xs: number[]) {
  xs.forEach(x => placeFruit(sim, {x, y: 400}));
}

describe('combos: 3 or more fruit in one swipe double that swipe\'s score', () => {
  test('two fruit in a swipe: just their own points', () => {
    const {sim, blades} = makeSim();
    fruitRow(sim, [120, 240]);
    swipe(blades[0]!, {x: 60, y: 400}, {x: 300, y: 400}, 0, 10);
    sim.advance(FRAME, 10);
    expect(sim.state.score).toBe(2);
    expect(events(sim, 'combo')).toHaveLength(0);
  });

  test('three fruit in one swipe: 3 + a 3-point combo bonus = 6', () => {
    const {sim, blades} = makeSim();
    fruitRow(sim, [100, 180, 260]);
    swipe(blades[0]!, {x: 40, y: 400}, {x: 320, y: 400}, 0, 10);
    sim.advance(FRAME, 10);
    expect(sim.state.score).toBe(6);
    const all = sim.drainEvents();
    expect(all.filter(e => e.type === 'slice')).toHaveLength(3);
    expect(all.filter(e => e.type === 'combo')).toEqual([
      expect.objectContaining({type: 'combo', count: 3, bonus: 3}),
    ]);
  });

  test('each further fruit in the same swipe adds one more bonus point (score = 2 x fruit)', () => {
    const {sim, blades} = makeSim();
    fruitRow(sim, [60, 130, 200, 270, 330]);
    swipe(blades[0]!, {x: 20, y: 400}, {x: 350, y: 400}, 0, 10);
    sim.advance(FRAME, 10);
    expect(sim.state.score).toBe(10); // 5 fruit doubled
    expect(events(sim, 'combo').map(e => (e as Extract<SimEvent, {type: 'combo'}>).count)).toEqual([3, 4, 5]);
  });

  test('separate swipes never chain, even back to back', () => {
    const {sim, blades} = makeSim();
    for (const [i, x] of [120, 180, 240].entries()) {
      placeFruit(sim, {x, y: 400});
      swipe(blades[0]!, {x: x - 50, y: 400}, {x: x + 50, y: 400}, i * 20, i * 20 + 10); // new stroke each time
      sim.advance(FRAME, i * 20 + 10);
    }
    expect(sim.state.score).toBe(3);
    expect(events(sim, 'combo')).toHaveLength(0);
  });

  test('fruit sliced by the same swipe but too far apart in time do not form a combo', () => {
    const {sim, blades} = makeSim({overrides: {collisionWindowMs: 2000}});
    const trail = blades[0]!;
    beginStroke(trail, 40, 400, 0);
    placeFruit(sim, {x: 120, y: 400});
    extendStroke(trail, 160, 400, 10, 20, 5000);
    sim.advance(FRAME, 10); // fruit 1 sliced at t=10
    placeFruit(sim, {x: 300, y: 400});
    extendStroke(trail, 340, 400, 600, 20, 5000); // same stroke, 590 ms later
    sim.advance(FRAME, 600);
    placeFruit(sim, {x: 380, y: 400});
    extendStroke(trail, 420, 400, 700, 20, 5000);
    sim.advance(FRAME, 700);
    expect(sim.state.score).toBe(3); // 1, then 2 (chain broken by the gap), then 3: no combo
    expect(events(sim, 'combo')).toHaveLength(0);
  });

  test('two blades count their own swipes separately', () => {
    const {sim, blades} = makeSim();
    fruitRow(sim, [100, 200, 300]);
    swipe(blades[0]!, {x: 60, y: 400}, {x: 220, y: 400}, 0, 10); // takes 2
    swipe(blades[1]!, {x: 260, y: 400}, {x: 340, y: 400}, 0, 10); // takes 1
    sim.advance(FRAME, 10);
    expect(sim.state.score).toBe(3); // no blade reached 3 on its own
    expect(events(sim, 'combo')).toHaveLength(0);
  });

  test('the combo counter starts over for the next game', () => {
    const {sim, blades} = makeSim();
    fruitRow(sim, [100, 180, 260]);
    swipe(blades[0]!, {x: 40, y: 400}, {x: 320, y: 400}, 0, 10);
    sim.advance(FRAME, 10);
    sim.reset();
    fruitRow(sim, [100, 180]);
    swipe(blades[0]!, {x: 40, y: 400}, {x: 220, y: 400}, 30, 40);
    sim.advance(FRAME, 40);
    expect(sim.state.score).toBe(2);
  });
});

describe('critical hits: a random +10', () => {
  test('always fires at chance 1, never at chance 0', () => {
    const on = makeSim({overrides: {critChance: 1}});
    placeFruit(on.sim, {x: 180, y: 400});
    swipe(on.blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    on.sim.advance(FRAME, 10);
    expect(on.sim.state.score).toBe(11);
    expect(events(on.sim, 'critical')).toEqual([expect.objectContaining({bonus: 10})]);

    const off = makeSim({overrides: {critChance: 0}});
    placeFruit(off.sim, {x: 180, y: 400});
    swipe(off.blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    off.sim.advance(FRAME, 10);
    expect(off.sim.state.score).toBe(1);
    expect(events(off.sim, 'critical')).toHaveLength(0);
  });

  test('is driven by the injected random source (reproducible)', () => {
    const lucky = makeSim({rng: () => 0.001, overrides: {critChance: 0.03}});
    placeFruit(lucky.sim, {x: 180, y: 400});
    swipe(lucky.blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    lucky.sim.advance(FRAME, 10);
    expect(lucky.sim.state.score).toBe(11); // 0.001 < 0.03: critical

    const unlucky = makeSim({rng: () => 0.5, overrides: {critChance: 0.03}});
    placeFruit(unlucky.sim, {x: 180, y: 400});
    swipe(unlucky.blades[0]!, {x: 100, y: 400}, {x: 260, y: 400}, 0, 10);
    unlucky.sim.advance(FRAME, 10);
    expect(unlucky.sim.state.score).toBe(1);
  });

  test('a critical is independent of the combo', () => {
    const {sim, blades} = makeSim({overrides: {critChance: 1}});
    fruitRow(sim, [100, 180, 260]);
    swipe(blades[0]!, {x: 40, y: 400}, {x: 320, y: 400}, 0, 10);
    sim.advance(FRAME, 10);
    expect(sim.state.score).toBe(6 + 30); // combo (6) + a critical per fruit
  });
});

describe('easy start (warm-up) and difficulty rules', () => {
  test('during the warm-up every burst is one fruit and there are no bombs', () => {
    const {sim} = makeSim({
      seed: 3,
      overrides: {
        warmupMs: 3000,
        bombChance: 1, // every spawn WOULD be a bomb without the warm-up
        spawnBurstMin: 3,
        spawnBurstMax: 3, // ...and every burst WOULD be three
        firstSpawnDelayMs: 100,
        spawnIntervalMinMs: 1200,
        spawnIntervalMaxMs: 1200,
        livesStart: 1_000_000,
      },
    });
    runAtHz(sim, 60, 1000); // first burst at 100 ms
    expect(sim.pool.activeCount()).toBe(1);
    expect(sim.pool.activeEntities().every(e => e.kind !== 'bomb')).toBe(true);

    runAtHz(sim, 60, 5000, 1000); // past the warm-up
    expect(sim.pool.activeEntities().some(e => e.kind === 'bomb')).toBe(true);
  });

  test('difficulty rules: casual 15 lives with a warm-up, challenge 3 lives, practice no bombs', () => {
    expect(difficultyTuning('casual')).toMatchObject({
      livesStart: 15,
      warmupMs: DIFFICULTY_RULES.casual.warmupMs,
      bombChance: 0.07,
    });
    expect(difficultyTuning('challenge')).toMatchObject({livesStart: 3, warmupMs: 0, bombChance: 0.07});
    expect(difficultyTuning('practice')).toMatchObject({livesStart: 15, warmupMs: 0, bombChance: 0});
    expect(createGameConfig(PHONE, difficultyTuning('casual')).livesStart).toBe(15);
  });

  test('casual survives 14 misses and ends on the 15th; challenge ends on the 3rd', () => {
    const missAt = (sim: ReturnType<typeof makeSim>['sim']) => {
      const cfg = sim.getConfig();
      placeFruit(sim, {x: 180, y: PHONE.height + cfg.cullMargin + 5, vy: 200});
      sim.advance(FRAME, 0);
    };
    const casual = makeSim({overrides: difficultyTuning('casual')});
    for (let i = 0; i < 14; i++) missAt(casual.sim);
    expect(casual.sim.state).toMatchObject({lives: 1, phase: 'running'});
    missAt(casual.sim);
    expect(casual.sim.state).toMatchObject({lives: 0, phase: 'gameover', gameOverReason: 'lives'});

    const hard = makeSim({overrides: difficultyTuning('challenge')});
    missAt(hard.sim);
    missAt(hard.sim);
    expect(hard.sim.state.phase).toBe('running');
    missAt(hard.sim);
    expect(hard.sim.state.phase).toBe('gameover');
  });

  test('practice mode never spawns a bomb', () => {
    const {sim} = makeSim({
      seed: 11,
      overrides: {...difficultyTuning('practice'), firstSpawnDelayMs: 50, livesStart: 1_000_000, spawnIntervalMinMs: 100, spawnIntervalMaxMs: 200},
    });
    let seenBomb = false;
    for (let i = 0; i < 60 * 60; i++) {
      sim.advance(FRAME, i * FRAME);
      if (sim.pool.activeEntities().some(e => e.kind === 'bomb')) {
        seenBomb = true;
        break;
      }
    }
    expect(seenBomb).toBe(false);
  });
});
