import type {BladeTrail} from './types';
import {MIN_SEGMENT_LENGTH_PX} from './constants';

/**
 * Segment-vs-circle test used for slicing.
 *
 * Semantics (all covered by tests):
 *  - The circle is a CLOSED disk: a segment tangent to it (distance == r) hits.
 *  - A segment that starts and ends inside the disk hits. The previous
 *    boundary-root test missed this case.
 *  - A very long segment (a fast swipe) is tested along its whole length, so
 *    it cannot tunnel through a fruit between two samples.
 *  - A segment shorter than `minLength` is a stationary sample, not a swipe,
 *    and never hits (a held finger must not slice).
 *  - Non-finite input never hits.
 */
export function segmentHitsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
  minLength: number = MIN_SEGMENT_LENGTH_PX,
): boolean {
  if (
    !(r > 0) ||
    !Number.isFinite(ax) ||
    !Number.isFinite(ay) ||
    !Number.isFinite(bx) ||
    !Number.isFinite(by) ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy)
  ) {
    return false;
  }
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < minLength * minLength) {
    return false;
  }
  // Closest point on the segment to the circle centre.
  let t = ((cx - ax) * dx + (cy - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + t * dx - cx;
  const py = ay + t * dy - cy;
  return px * px + py * py <= r * r;
}

/**
 * Finds a collision-active segment of `trail` that hits the circle.
 *
 * A segment is collision-active while the sample time of its NEWER endpoint is
 * within `windowMs` of `nowMs`; older segments are ignored, so a blade that has
 * stopped (or a stale trail) can no longer slice. Returns the index `i` of the
 * newer endpoint (segment points[i-1] -> points[i]) or -1 for no hit.
 * Allocation free.
 */
export function findTrailHit(
  trail: BladeTrail,
  nowMs: number,
  windowMs: number,
  cx: number,
  cy: number,
  r: number,
  minLength: number = MIN_SEGMENT_LENGTH_PX,
): number {
  if (!trail.active) {
    return -1;
  }
  const pts = trail.points;
  for (let i = pts.length - 1; i >= 1; i--) {
    const b = pts[i]!;
    if (nowMs - b.t > windowMs) {
      break; // this and every earlier segment is expired
    }
    const a = pts[i - 1]!;
    if (segmentHitsCircle(a.x, a.y, b.x, b.y, cx, cy, r, minLength)) {
      return i;
    }
  }
  return -1;
}

export function trailHitsCircle(
  trail: BladeTrail,
  nowMs: number,
  windowMs: number,
  cx: number,
  cy: number,
  r: number,
  minLength: number = MIN_SEGMENT_LENGTH_PX,
): boolean {
  return findTrailHit(trail, nowMs, windowMs, cx, cy, r, minLength) >= 0;
}
