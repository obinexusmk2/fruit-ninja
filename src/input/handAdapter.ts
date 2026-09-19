import type {BladeSet} from './bladeSet';
import {ClockSync} from './clockSync';
import {
  DEFAULT_TRACKER_CONFIG,
  HandTracker,
  type Detection,
  type TrackerConfig,
} from './handTracker';
import {
  bladeAnchor,
  landmarkToCanvas,
  LANDMARKS_PER_HAND,
  VALUES_PER_HAND,
  type FrameGeometry,
  type ViewGeometry,
} from './transforms';
import {defaultClock, type Clock, type Point} from './types';
import {RollingStats} from '../perf/rolling';

/** Structural copy of the native HandFrameEvent so this module stays SDK-free. */
export interface HandFrameLike {
  sessionId: number;
  seq: number;
  frameTimeMs: number;
  emitTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  lens: string;
  handCount: number;
  landmarks: ArrayLike<number>;
  handedness: ArrayLike<number>;
}

export type DropReason = 'obsolete-session' | 'out-of-order' | 'stale' | 'invalid';

export interface FrameResult {
  accepted: boolean;
  reason?: DropReason;
}

export interface HandAdapterOptions {
  /** Frames older than this (ms, camera-to-JS) are dropped and break the blades. */
  maxSampleAgeMs: number;
  /** With no accepted sample for this long (ms) every blade is cleared. */
  staleMs: number;
  /** One-hand mode: a single blade and a single tracked hand. */
  oneHand: boolean;
  tracker: Partial<TrackerConfig>;
}

export const DEFAULT_HAND_ADAPTER_OPTIONS: HandAdapterOptions = {
  maxSampleAgeMs: 250,
  staleMs: 250,
  oneHand: false,
  tracker: {},
};

/** One tracked hand's skeleton in canvas coordinates, for drawing over the preview. */
export interface OverlayHand {
  id: number | null;
  slot: number | null;
  confirmed: boolean;
  points: Point[];
}

export interface HandOverlay {
  t: number;
  hands: OverlayHand[];
}

export interface AdapterStats {
  accepted: number;
  droppedObsoleteSession: number;
  droppedOutOfOrder: number;
  droppedStale: number;
  droppedInvalid: number;
  /** Camera-frame-to-JS age at receipt, ms (see ClockSync for what "age" means). */
  receiveAge: RollingStats;
}

/**
 * Turns native hand samples into blade strokes.
 *
 * Pipeline per frame:
 *   validate session / sequence / time  ->  reject stale
 *   -> fingertip midpoint (landmarks 8, 12) -> transform (once) to canvas px
 *   -> HandTracker (persistent identity) -> BladeSet strokes.
 *
 * Guarantees: a hand that disappears ends its stroke on that very frame;
 * reacquisition starts a NEW stroke, so nothing can slice across the screen;
 * stale, duplicate and out-of-order frames and frames from an old session are
 * dropped without touching any blade.
 */
export class HandAdapter {
  readonly stats: AdapterStats = {
    accepted: 0,
    droppedObsoleteSession: 0,
    droppedOutOfOrder: 0,
    droppedStale: 0,
    droppedInvalid: 0,
    receiveAge: new RollingStats(600),
  };

  private readonly clockSync = new ClockSync();
  private readonly tracker: HandTracker;
  private sessionId: number | null = null;
  private lastSeq = -Infinity;
  private lastFrameT = -Infinity;
  private lastAcceptedAt = -Infinity;
  private lastHandAt: number | null = null;
  private confirmedCount = 0;
  private overlay: HandOverlay | null = null;
  private view: ViewGeometry = {width: 1, height: 1, fit: 'cover'};
  private trackerConfig: TrackerConfig;

  constructor(
    private readonly blades: BladeSet,
    private options: HandAdapterOptions = DEFAULT_HAND_ADAPTER_OPTIONS,
    private readonly clock: Clock = defaultClock,
  ) {
    this.trackerConfig = this.buildTrackerConfig();
    this.tracker = new HandTracker(this.trackerConfig);
  }

  private buildTrackerConfig(): TrackerConfig {
    return {
      ...DEFAULT_TRACKER_CONFIG,
      // The gate scales with the screen so a fast swipe still matches its own track.
      matchDistance: Math.max(120, 0.3 * Math.hypot(this.view.width, this.view.height)),
      ...this.options.tracker,
      maxHands: this.options.oneHand ? 1 : 2,
    };
  }

  setOptions(options: Partial<HandAdapterOptions>): void {
    this.options = {...this.options, ...options};
    this.trackerConfig = this.buildTrackerConfig();
    this.tracker.setConfig(this.trackerConfig);
    if (options.oneHand !== undefined) {
      this.resetTracking();
    }
  }

  /** The geometry of the view the camera preview is shown in (and blades are drawn in). */
  setView(view: ViewGeometry): void {
    this.view = view;
    this.trackerConfig = this.buildTrackerConfig();
    this.tracker.setConfig(this.trackerConfig);
  }

  /** Only samples carrying this session id are accepted (null accepts none). */
  setSession(id: number | null): void {
    if (id !== this.sessionId) {
      this.sessionId = id;
      this.resetTracking();
      this.lastSeq = -Infinity;
      this.lastFrameT = -Infinity;
      this.clockSync.reset();
    }
  }

  getSession(): number | null {
    return this.sessionId;
  }

  /** Forgets identities and ends every stroke. */
  resetTracking(): void {
    this.endAllStrokes();
    this.tracker.reset();
    this.confirmedCount = 0;
    this.lastHandAt = null;
    this.overlay = null;
    this.lastAcceptedAt = -Infinity;
  }

  reset(): void {
    this.setSession(null);
    this.resetTracking();
  }

  getConfirmedCount(): number {
    return this.confirmedCount;
  }

  getOverlay(): HandOverlay | null {
    return this.overlay;
  }

  /** ms since a confirmed hand was last seen; null if none has been seen yet. */
  msSinceAnyHand(now: number = this.clock()): number | null {
    return this.lastHandAt === null ? null : now - this.lastHandAt;
  }

  /** Newest accepted frame time on the JS clock (for age measurements). */
  getLastFrameTime(): number {
    return this.lastFrameT;
  }

  onFrame(frame: HandFrameLike): FrameResult {
    const now = this.clock();

    if (this.sessionId === null || frame.sessionId !== this.sessionId) {
      this.stats.droppedObsoleteSession++;
      return {accepted: false, reason: 'obsolete-session'};
    }
    if (!isValidFrame(frame)) {
      this.stats.droppedInvalid++;
      return {accepted: false, reason: 'invalid'};
    }
    if (frame.seq <= this.lastSeq) {
      this.stats.droppedOutOfOrder++;
      return {accepted: false, reason: 'out-of-order'};
    }

    this.clockSync.observe(frame.emitTimeMs, now);
    const t = this.clockSync.toJs(frame.frameTimeMs);
    if (t < this.lastFrameT) {
      this.stats.droppedOutOfOrder++;
      return {accepted: false, reason: 'out-of-order'};
    }
    this.lastSeq = frame.seq;

    const age = now - t;
    if (age > this.options.maxSampleAgeMs) {
      // Too old to act on: end every stroke so nothing stale can slice, and
      // make the next fresh sample start a new stroke.
      this.stats.droppedStale++;
      this.endAllStrokes();
      this.tracker.breakAll();
      return {accepted: false, reason: 'stale'};
    }
    this.lastFrameT = t;
    this.lastAcceptedAt = now;
    this.stats.accepted++;
    this.stats.receiveAge.add(Math.max(0, age));

    // Landmarks are normalised to the UPRIGHT frame (native applied the rotation),
    // never mirrored or cropped by native: mirror once here for the front camera.
    const geometry: FrameGeometry = {
      width: frame.imageWidth,
      height: frame.imageHeight,
      rotationDegrees: 0,
      mirror: frame.lens === 'front',
    };

    const detections: Detection[] = [];
    const skeletons: Point[][] = [];
    const handCount = Math.min(frame.handCount, 2);
    for (let h = 0; h < handCount; h++) {
      const anchor = bladeAnchor(frame.landmarks, h);
      if (!anchor) {
        continue;
      }
      const p = landmarkToCanvas(anchor, geometry, this.view);
      detections.push({x: p.x, y: p.y, handedness: frame.handedness[h] ?? -1});
      const pts: Point[] = [];
      for (let i = 0; i < LANDMARKS_PER_HAND; i++) {
        const o = h * VALUES_PER_HAND + i * 2;
        pts.push(
          landmarkToCanvas({x: frame.landmarks[o]!, y: frame.landmarks[o + 1]!}, geometry, this.view),
        );
      }
      skeletons.push(pts);
    }

    const result = this.tracker.update(t, detections);

    for (const lost of result.lost) {
      this.blades.end('hand', lost.slot);
    }
    for (const a of result.active) {
      if (a.restart) {
        this.blades.begin('hand', a.slot, a.x, a.y, t);
      } else {
        this.blades.extend('hand', a.slot, a.x, a.y, t);
      }
    }

    this.confirmedCount = result.confirmedCount;
    if (result.confirmedCount > 0) {
      this.lastHandAt = now;
    }

    // Skeleton overlay: attribute each detection to its track by position.
    const tracks = this.tracker.getTracks();
    this.overlay = {
      t,
      hands: skeletons.map((points, i) => {
        const d = detections[i]!;
        let match = null as (typeof tracks)[number] | null;
        let bestDist = Infinity;
        for (const tr of tracks) {
          const dist = Math.hypot(tr.x - d.x, tr.y - d.y);
          if (dist < bestDist) {
            bestDist = dist;
            match = tr;
          }
        }
        return {
          id: match ? match.id : null,
          slot: match ? match.slot : null,
          confirmed: match ? match.confirmed : false,
          points,
        };
      }),
    };
    return {accepted: true};
  }

  /**
   * Watchdog, called every rendered frame. If no fresh sample has been accepted
   * for `staleMs`, every blade is cleared immediately: a frozen or vanished
   * camera must never leave a live blade behind.
   */
  tick(now: number = this.clock()): void {
    if (
      this.lastAcceptedAt !== -Infinity &&
      now - this.lastAcceptedAt > this.options.staleMs
    ) {
      this.endAllStrokes();
      this.tracker.breakAll();
      this.confirmedCount = 0;
      this.overlay = null;
      // Do not fire again until a new sample is accepted.
      this.lastAcceptedAt = -Infinity;
    }
  }

  private endAllStrokes(): void {
    for (const trail of this.blades.trails) {
      this.blades.end('hand', trail.slot);
    }
  }
}

function isValidFrame(f: HandFrameLike): boolean {
  return (
    Number.isFinite(f.seq) &&
    Number.isFinite(f.frameTimeMs) &&
    Number.isFinite(f.emitTimeMs) &&
    f.imageWidth > 0 &&
    f.imageHeight > 0 &&
    f.handCount >= 0 &&
    f.landmarks.length >= f.handCount * VALUES_PER_HAND
  );
}
