import {
  APEX_MAX,
  APEX_MIN,
  BOMB_CHANCE,
  BOMB_RADIUS_RATIO,
  COLLISION_WINDOW_MS,
  FIRST_SPAWN_DELAY_MS,
  FIXED_STEP_MS,
  FRUIT_RADIUS_PER_UNIT,
  GRAVITY_PER_HEIGHT,
  HALF_KICK_PER_UNIT,
  HALF_LATERAL_PER_UNIT,
  LAUNCH_VX_PER_WIDTH,
  LIVES_START,
  MAX_FRAME_DELTA_MS,
  MAX_ROTATION_SPEED,
  MAX_STEPS_PER_ADVANCE,
  MIN_SEGMENT_LENGTH_PX,
  POOL_SIZE,
  SPAWN_BURST_MAX,
  SPAWN_BURST_MIN,
  SPAWN_INTERVAL_MAX_MS,
  SPAWN_INTERVAL_MIN_MS,
  SPLASH_DURATION_MS,
  STROKE_GAP_MS,
  TRAIL_MAX_POINTS,
  TRAIL_VISUAL_TTL_MS,
} from './constants';

export interface Viewport {
  width: number;
  height: number;
}

export interface GameConfig {
  viewport: Viewport;
  /** Reference length used to scale targets: min(width, height), clamped. */
  unit: number;
  gravity: number; // px/s^2
  fruitRadius: number;
  bombRadius: number;
  spriteSize: number;
  apexMin: number; // px
  apexMax: number; // px
  launchVx: number; // px/s (symmetric +/-)
  halfLateralSpeed: number;
  halfKickSpeed: number;
  maxRotationSpeed: number;
  spawnMarginY: number;
  cullMargin: number;
  bombChance: number;
  livesStart: number;
  poolSize: number;
  firstSpawnDelayMs: number;
  spawnIntervalMinMs: number;
  spawnIntervalMaxMs: number;
  spawnBurstMin: number;
  spawnBurstMax: number;
  splashDurationMs: number;
  fixedStepMs: number;
  maxFrameDeltaMs: number;
  maxStepsPerAdvance: number;
  collisionWindowMs: number;
  trailVisualTtlMs: number;
  trailMaxPoints: number;
  strokeGapMs: number;
  minSegmentLength: number;
}

export type GameTuning = Partial<Omit<GameConfig, 'viewport'>>;

const UNIT_MIN = 280;
const UNIT_MAX = 900;

/**
 * Builds a config scaled to the measured playable area. Every distance is
 * derived from the viewport so launch heights, target sizes and speeds stay
 * proportional on small phones, large phones and tablets, in either
 * orientation. `overrides` win over derived values (used by tests and tuning).
 */
export function createGameConfig(
  viewport: Viewport,
  overrides: GameTuning = {},
): GameConfig {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const unit = Math.min(UNIT_MAX, Math.max(UNIT_MIN, Math.min(width, height)));
  const fruitRadius = FRUIT_RADIUS_PER_UNIT * unit;

  const base: GameConfig = {
    viewport: {width, height},
    unit,
    gravity: GRAVITY_PER_HEIGHT * height,
    fruitRadius,
    bombRadius: fruitRadius * BOMB_RADIUS_RATIO,
    spriteSize: fruitRadius * 2,
    apexMin: APEX_MIN * height,
    apexMax: APEX_MAX * height,
    launchVx: LAUNCH_VX_PER_WIDTH * width,
    halfLateralSpeed: HALF_LATERAL_PER_UNIT * unit,
    halfKickSpeed: HALF_KICK_PER_UNIT * unit,
    maxRotationSpeed: MAX_ROTATION_SPEED,
    spawnMarginY: fruitRadius * 0.72,
    cullMargin: fruitRadius * 2.9,
    bombChance: BOMB_CHANCE,
    livesStart: LIVES_START,
    poolSize: POOL_SIZE,
    firstSpawnDelayMs: FIRST_SPAWN_DELAY_MS,
    spawnIntervalMinMs: SPAWN_INTERVAL_MIN_MS,
    spawnIntervalMaxMs: SPAWN_INTERVAL_MAX_MS,
    spawnBurstMin: SPAWN_BURST_MIN,
    spawnBurstMax: SPAWN_BURST_MAX,
    splashDurationMs: SPLASH_DURATION_MS,
    fixedStepMs: FIXED_STEP_MS,
    maxFrameDeltaMs: MAX_FRAME_DELTA_MS,
    maxStepsPerAdvance: MAX_STEPS_PER_ADVANCE,
    collisionWindowMs: COLLISION_WINDOW_MS,
    trailVisualTtlMs: TRAIL_VISUAL_TTL_MS,
    trailMaxPoints: TRAIL_MAX_POINTS,
    strokeGapMs: STROKE_GAP_MS,
    minSegmentLength: MIN_SEGMENT_LENGTH_PX,
  };

  return {...base, ...overrides};
}
