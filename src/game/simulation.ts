import {createGameConfig, type GameConfig, type GameTuning, type Viewport} from './config';
import {findTrailHit} from './collisionDetection';
import {burstCount, nextSpawnDelay, spawnFruit} from './fruitSpawner';
import {FruitPool} from './objectPool';
import type {Rng} from './rng';
import type {
  BladeTrail,
  FruitEntity,
  FruitKind,
  GameOverReason,
  GameState,
  SimEvent,
} from './types';

/** Tolerance so 1000/60 ms frames divide into 1000/120 ms steps without drift. */
const STEP_EPSILON_MS = 1e-6;

/**
 * Deterministic, renderer-independent game simulation.
 *
 * Time model: callers report wall-clock frame deltas to `advance()`. The
 * simulation consumes them in fixed steps (config.fixedStepMs) from an
 * accumulator, so behaviour is identical at 30, 60 or 120 Hz and independent
 * of how often camera results arrive. Frame deltas are clamped and the number
 * of catch-up steps per call is bounded so a stall cannot fast-forward the game.
 *
 * Rule summary (each is covered by tests):
 *  - +1 score per sliced fruit; a fruit can be sliced once even if both blades
 *    cross it in the same update.
 *  - A fruit that falls out of the playable area unsliced costs one life.
 *    A bomb that falls out costs nothing.
 *  - Slicing a bomb ends the game immediately. Bombs are resolved before
 *    fruit, so a same-update bomb hit awards no fruit score.
 *  - The game ends exactly once (one 'gameover' event); after that nothing
 *    advances and no score or life can change.
 */
export class GameSimulation {
  readonly pool: FruitPool;
  state: GameState;

  private config: GameConfig;
  private readonly overrides: GameTuning;
  private readonly blades: readonly BladeTrail[];
  private readonly rng: Rng;
  private accumulatorMs = 0;
  private spawnTimerMs = 0;
  private events: SimEvent[] = [];
  private hitSlot = -1;
  private hitAngle = 0;

  constructor(
    viewport: Viewport,
    blades: readonly BladeTrail[],
    rng: Rng = Math.random,
    overrides: GameTuning = {},
  ) {
    this.overrides = overrides;
    this.config = createGameConfig(viewport, overrides);
    this.blades = blades;
    this.rng = rng;
    this.pool = new FruitPool(this.config.poolSize);
    this.state = this.freshState();
    this.spawnTimerMs = this.config.firstSpawnDelayMs;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  /** Starts a new game: clears entities, score, lives, timers and events. */
  reset(): void {
    this.pool.releaseAll();
    this.state = this.freshState();
    this.accumulatorMs = 0;
    this.spawnTimerMs = this.config.firstSpawnDelayMs;
    this.events = [];
  }

  /**
   * Forgets accumulated frame time. Call when resuming from pause/background
   * so the time spent away is not simulated.
   */
  resetTiming(): void {
    this.accumulatorMs = 0;
  }

  /**
   * Adapts to a new playable area (rotation, window resize, tablet). Entities
   * keep their relative position and speed; targets and gravity are rescaled.
   */
  resize(viewport: Viewport): void {
    const old = this.config.viewport;
    const next = createGameConfig(viewport, this.overrides);
    const sx = next.viewport.width / old.width;
    const sy = next.viewport.height / old.height;
    if (sx !== 1 || sy !== 1) {
      for (const e of this.pool.entities()) {
        if (!e.active) {
          continue;
        }
        e.x *= sx;
        e.y *= sy;
        e.vx *= sx;
        e.vy *= sy;
        e.half1x *= sx;
        e.half1y *= sy;
        e.half1vx *= sx;
        e.half1vy *= sy;
        e.half2x *= sx;
        e.half2y *= sy;
        e.half2vx *= sx;
        e.half2vy *= sy;
        e.splashX *= sx;
        e.splashY *= sy;
      }
    }
    this.config = next;
  }

  /**
   * Advances the simulation by a wall-clock frame delta.
   * @param frameDeltaMs time since the previous frame (ms)
   * @param nowMs current time on the same monotonic clock blade samples use;
   *   it decides which trail segments are still collision-active.
   * @returns number of fixed steps executed
   */
  advance(frameDeltaMs: number, nowMs: number): number {
    if (this.state.phase !== 'running') {
      return 0;
    }
    const cfg = this.config;
    const delta =
      Number.isFinite(frameDeltaMs) && frameDeltaMs > 0
        ? Math.min(frameDeltaMs, cfg.maxFrameDeltaMs)
        : 0;
    this.accumulatorMs += delta;

    let steps = 0;
    while (
      this.accumulatorMs + STEP_EPSILON_MS >= cfg.fixedStepMs &&
      steps < cfg.maxStepsPerAdvance
    ) {
      this.accumulatorMs -= cfg.fixedStepMs;
      this.step(cfg.fixedStepMs, nowMs);
      steps++;
      if (this.state.phase !== 'running') {
        this.accumulatorMs = 0;
        break;
      }
    }
    if (this.accumulatorMs < 0) {
      this.accumulatorMs = 0;
    }
    if (steps === cfg.maxStepsPerAdvance) {
      // Bounded catch-up: discard any backlog instead of spiralling.
      this.accumulatorMs = Math.min(this.accumulatorMs, cfg.fixedStepMs);
    }
    return steps;
  }

  /** Returns and clears the events produced since the last call. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private freshState(): GameState {
    return {
      score: 0,
      lives: this.config.livesStart,
      phase: 'running',
      gameOverReason: null,
      droppedSpawns: 0,
    };
  }

  private step(dtMs: number, nowMs: number): void {
    const cfg = this.config;
    const dt = dtMs / 1000;

    this.integrate(dt, dtMs);

    this.spawnTimerMs -= dtMs;
    if (this.spawnTimerMs <= 0) {
      const n = burstCount(cfg, this.rng);
      for (let i = 0; i < n; i++) {
        if (!spawnFruit(this.pool, cfg, this.rng)) {
          this.state.droppedSpawns++;
        }
      }
      this.spawnTimerMs += nextSpawnDelay(cfg, this.rng);
    }

    this.collide(nowMs);
    if (this.state.phase !== 'running') {
      return;
    }
    this.cull();
  }

  private integrate(dt: number, dtMs: number): void {
    const g = this.config.gravity;
    for (const e of this.pool.entities()) {
      if (!e.active) {
        continue;
      }
      if (e.state === 'whole') {
        e.vy += g * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rotation += e.rotationSpeed * dt;
      } else if (e.state === 'sliced') {
        e.half1vy += g * dt;
        e.half1x += e.half1vx * dt;
        e.half1y += e.half1vy * dt;
        e.half1rot += e.rotationSpeed * dt;
        e.half2vy += g * dt;
        e.half2x += e.half2vx * dt;
        e.half2y += e.half2vy * dt;
        e.half2rot -= e.rotationSpeed * dt;
        if (e.splashTimer > 0) {
          e.splashTimer = Math.max(0, e.splashTimer - dtMs);
        }
      } else if (e.state === 'exploding') {
        if (e.splashTimer > 0) {
          e.splashTimer = Math.max(0, e.splashTimer - dtMs);
        }
      }
    }
  }

  /** Bombs first (game over wins ties), then fruit; entity-major so a fruit scores once. */
  private collide(nowMs: number): void {
    const cfg = this.config;
    const entities = this.pool.entities();

    for (const e of entities) {
      if (!e.active || e.state !== 'whole' || e.kind !== 'bomb') {
        continue;
      }
      if (this.bladeHits(e, cfg.bombRadius, nowMs)) {
        e.state = 'exploding';
        e.splashX = e.x;
        e.splashY = e.y;
        e.splashTimer = cfg.splashDurationMs;
        this.events.push({
          type: 'bomb',
          entityId: e.id,
          x: e.x,
          y: e.y,
          slot: this.hitSlot,
        });
        this.endGame('bomb');
        return;
      }
    }

    for (const e of entities) {
      if (!e.active || e.state !== 'whole' || e.kind === 'bomb') {
        continue;
      }
      if (this.bladeHits(e, cfg.fruitRadius, nowMs)) {
        this.slice(e);
      }
    }
  }

  /** True if any blade slices the circle; records which slot and at what angle. */
  private bladeHits(e: FruitEntity, radius: number, nowMs: number): boolean {
    const cfg = this.config;
    for (let s = 0; s < this.blades.length; s++) {
      const trail = this.blades[s]!;
      const i = findTrailHit(
        trail,
        nowMs,
        cfg.collisionWindowMs,
        e.x,
        e.y,
        radius,
        cfg.minSegmentLength,
      );
      if (i >= 0) {
        const a = trail.points[i - 1]!;
        const b = trail.points[i]!;
        this.hitSlot = trail.slot;
        this.hitAngle = Math.atan2(b.y - a.y, b.x - a.x);
        return true;
      }
    }
    return false;
  }

  private slice(e: FruitEntity): void {
    const cfg = this.config;
    // Halves part perpendicular to the blade direction, with a shared upward kick.
    const nx = -Math.sin(this.hitAngle) * cfg.halfLateralSpeed;
    const ny = Math.cos(this.hitAngle) * cfg.halfLateralSpeed;
    e.state = 'sliced';
    e.half1x = e.x;
    e.half1y = e.y;
    e.half1vx = e.vx - nx;
    e.half1vy = e.vy - ny - cfg.halfKickSpeed;
    e.half1rot = e.rotation;
    e.half2x = e.x;
    e.half2y = e.y;
    e.half2vx = e.vx + nx;
    e.half2vy = e.vy + ny - cfg.halfKickSpeed;
    e.half2rot = e.rotation;
    e.splashX = e.x;
    e.splashY = e.y;
    e.splashTimer = cfg.splashDurationMs;
    this.state.score++;
    this.events.push({
      type: 'slice',
      entityId: e.id,
      kind: e.kind as FruitKind,
      x: e.x,
      y: e.y,
      slot: this.hitSlot,
      score: this.state.score,
    });
  }

  private cull(): void {
    const cfg = this.config;
    const limit = cfg.viewport.height + cfg.cullMargin;
    for (const e of this.pool.entities()) {
      if (!e.active) {
        continue;
      }
      if (e.state === 'whole') {
        if (e.y > limit && e.vy > 0) {
          const kind = e.kind;
          const id = e.id;
          this.pool.release(e);
          if (kind !== 'bomb') {
            this.state.lives = Math.max(0, this.state.lives - 1);
            this.events.push({
              type: 'miss',
              entityId: id,
              kind,
              lives: this.state.lives,
            });
            if (this.state.lives === 0) {
              this.endGame('lives');
              return;
            }
          }
        }
      } else if (e.state === 'sliced') {
        if (e.half1y > limit && e.half2y > limit && e.splashTimer <= 0) {
          this.pool.release(e);
        }
      } else if (e.state === 'exploding') {
        if (e.splashTimer <= 0) {
          this.pool.release(e);
        }
      }
    }
  }

  /** The single terminal transition: ignored if the game already ended. */
  private endGame(reason: GameOverReason): void {
    if (this.state.phase !== 'running') {
      return;
    }
    this.state.phase = 'gameover';
    this.state.gameOverReason = reason;
    this.events.push({type: 'gameover', reason, score: this.state.score});
  }
}
