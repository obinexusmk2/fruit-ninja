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
  // Whole fruit position
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
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
  splashTimer: number;
  active: boolean;
}

export interface TrailPoint {
  x: number;
  y: number;
}

export interface BladeTrail {
  points: TrailPoint[];
  active: boolean;
  color: string;
}

export interface GameState {
  score: number;
  lives: number;
  isGameOver: boolean;
  frameCount: number;
  spawnInterval: number;
  nextSpawnAt: number;
}
