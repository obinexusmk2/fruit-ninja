import type {BladeTrail} from './types';

/** Result of extending a stroke. */
export type ExtendResult = 'extended' | 'restarted' | 'rejected';

export function createTrail(slot: number, color: string): BladeTrail {
  return {slot, color, points: [], active: false, strokeId: 0};
}

/** Starts a new stroke. Nothing from a previous stroke is ever connected to it. */
export function beginStroke(
  trail: BladeTrail,
  x: number,
  y: number,
  t: number,
): void {
  trail.points.length = 0;
  trail.points.push({x, y, t});
  trail.active = true;
  trail.strokeId++;
}

/**
 * Appends a sample to the current stroke.
 *
 *  - Non-finite coordinates/time are rejected.
 *  - A sample older than the newest one (out of order) is rejected.
 *  - A gap longer than `gapMs` since the previous sample starts a NEW stroke
 *    instead of bridging the gap, so a stalled input cannot slice across the
 *    screen when it resumes.
 *  - With no active stroke, the sample starts one.
 */
export function extendStroke(
  trail: BladeTrail,
  x: number,
  y: number,
  t: number,
  maxPoints: number,
  gapMs: number,
): ExtendResult {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) {
    return 'rejected';
  }
  if (!trail.active || trail.points.length === 0) {
    beginStroke(trail, x, y, t);
    return 'restarted';
  }
  const last = trail.points[trail.points.length - 1]!;
  if (t < last.t) {
    return 'rejected';
  }
  if (t - last.t > gapMs) {
    beginStroke(trail, x, y, t);
    return 'restarted';
  }
  trail.points.push({x, y, t});
  if (trail.points.length > maxPoints) {
    trail.points.splice(0, trail.points.length - maxPoints);
  }
  return 'extended';
}

/** Ends the stroke and clears it immediately (no lingering collision segments). */
export function endStroke(trail: BladeTrail): void {
  trail.points.length = 0;
  trail.active = false;
}

/**
 * Drops points older than `ttlMs` from the drawn trail. The newest point is
 * always kept so an idle-but-held blade keeps its continuity anchor.
 */
export function pruneTrail(
  trail: BladeTrail,
  nowMs: number,
  ttlMs: number,
): void {
  const pts = trail.points;
  let drop = 0;
  while (drop < pts.length - 1 && nowMs - pts[drop]!.t > ttlMs) {
    drop++;
  }
  if (drop > 0) {
    pts.splice(0, drop);
  }
}
