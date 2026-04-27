import type {BladeTrail} from './types';
import {BOMB_RADIUS, FRUIT_RADIUS, SLICE_HISTORY} from './constants';

// Returns whether segment p1→p2 intersects circle at (cx,cy) with radius r.
function segmentIntersectsCircle(
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  cx: number, cy: number,
  r: number,
): boolean {
  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const fx = p1x - cx;
  const fy = p1y - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return false;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// Checks the last SLICE_HISTORY trail segments against a circle.
export function trailHitsCircle(
  trail: BladeTrail,
  cx: number,
  cy: number,
  isBomb: boolean,
): boolean {
  const pts = trail.points;
  const len = pts.length;
  if (len < 2 || !trail.active) return false;

  const r = isBomb ? BOMB_RADIUS : FRUIT_RADIUS;
  const checks = Math.min(SLICE_HISTORY, len - 1);

  for (let i = 0; i < checks; i++) {
    const a = pts[len - 2 - i];
    const b = pts[len - 1 - i];
    if (!a || !b) continue;
    if (segmentIntersectsCircle(a.x, a.y, b.x, b.y, cx, cy, r)) return true;
  }
  return false;
}
