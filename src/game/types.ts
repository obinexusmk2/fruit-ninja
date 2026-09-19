export type FruitKind =
  | 'apple'
  | 'banana'
  | 'orange'
  | 'coconut'
  | 'pineapple'
  | 'watermelon';

export type EntityKind = FruitKind | 'bomb';

export type EntityState =
  | 'whole'
  | 'sliced'
  | 'exploding'
  | 'inactive';

export interface FruitEntity {
  id: number;
  kind: EntityKind;
  state: EntityState;
  // Whole fruit position (viewport pixels, y grows downwards) and velocity (px/s).
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  // radians per second
  rotationSpeed: number;
  // Half sprites after slicing
  half1x: number;
  half1y: number;
  half1vx: number;
  half1vy: number;
  half1rot: number;
  half2x: number;
  half2y: number;
  half2vx: number;
  half2vy: number;
  half2rot: number;
  splashX: number;
  splashY: number;
  // Remaining splash / explosion time in milliseconds.
  splashTimer: number;
  active: boolean;
}

/**
 * A blade sample. `t` is the sample time in milliseconds on the same monotonic
 * clock the simulation is driven with (see GameSimulation.advance).
 */
export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export interface BladeTrail {
  /** Fixed slot: 0 = cyan blade, 1 = orange blade. */
  slot: number;
  color: string;
  points: TrailPoint[];
  active: boolean;
  /** Increments every time a new stroke starts; segments never cross strokes. */
  strokeId: number;
}

export type GamePhase = 'running' | 'gameover';
export type GameOverReason = 'bomb' | 'lives';

export interface GameState {
  score: number;
  lives: number;
  phase: GamePhase;
  gameOverReason: GameOverReason | null;
  /** Spawns skipped because every pool slot was in use (diagnostics). */
  droppedSpawns: number;
}

export type SimEvent =
  | {
      type: 'slice';
      entityId: number;
      kind: FruitKind;
      x: number;
      y: number;
      slot: number;
      score: number;
    }
  /** 3+ fruit in one swipe: `bonus` extra points were added (this swipe's score is doubled). */
  | {type: 'combo'; count: number; bonus: number; slot: number; x: number; y: number}
  /** A random critical hit: `bonus` extra points were added. */
  | {type: 'critical'; bonus: number; x: number; y: number}
  | {type: 'bomb'; entityId: number; x: number; y: number; slot: number}
  | {type: 'miss'; entityId: number; kind: FruitKind; lives: number}
  | {type: 'gameover'; reason: GameOverReason; score: number};
