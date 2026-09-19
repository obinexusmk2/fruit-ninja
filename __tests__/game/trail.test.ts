import {
  beginStroke,
  createTrail,
  endStroke,
  extendStroke,
  pruneTrail,
} from '../../src/game/trail';

const MAX = 5;
const GAP = 200;

describe('blade trail store', () => {
  test('beginStroke starts a fresh stroke and bumps the stroke id', () => {
    const t = createTrail(0, '#0ff');
    expect(t.active).toBe(false);
    beginStroke(t, 1, 2, 10);
    expect(t.active).toBe(true);
    expect(t.points).toEqual([{x: 1, y: 2, t: 10}]);
    const first = t.strokeId;
    beginStroke(t, 5, 6, 20);
    expect(t.points).toEqual([{x: 5, y: 6, t: 20}]);
    expect(t.strokeId).toBe(first + 1);
  });

  test('extendStroke appends and caps the point count', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 0);
    for (let i = 1; i <= 10; i++) {
      expect(extendStroke(t, i, i, i * 10, MAX, GAP)).toBe('extended');
    }
    expect(t.points).toHaveLength(MAX);
    expect(t.points[MAX - 1]).toEqual({x: 10, y: 10, t: 100});
  });

  test('out-of-order samples are rejected and do not change the trail', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 100);
    extendStroke(t, 5, 5, 120, MAX, GAP);
    expect(extendStroke(t, 9, 9, 110, MAX, GAP)).toBe('rejected');
    expect(t.points).toHaveLength(2);
  });

  test('non-finite samples are rejected', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 0);
    expect(extendStroke(t, NaN, 1, 10, MAX, GAP)).toBe('rejected');
    expect(extendStroke(t, 1, Infinity, 10, MAX, GAP)).toBe('rejected');
    expect(extendStroke(t, 1, 1, NaN, MAX, GAP)).toBe('rejected');
    expect(t.points).toHaveLength(1);
  });

  test('a long gap starts a NEW stroke rather than bridging the gap', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 0);
    extendStroke(t, 10, 10, 50, MAX, GAP);
    const id = t.strokeId;
    expect(extendStroke(t, 900, 900, 50 + GAP + 1, MAX, GAP)).toBe('restarted');
    expect(t.strokeId).toBe(id + 1);
    // The old points (and any segment to the far point) are gone.
    expect(t.points).toEqual([{x: 900, y: 900, t: 50 + GAP + 1}]);
  });

  test('a sample with no active stroke starts one', () => {
    const t = createTrail(0, '#0ff');
    expect(extendStroke(t, 3, 4, 7, MAX, GAP)).toBe('restarted');
    expect(t.active).toBe(true);
    expect(t.points).toHaveLength(1);
  });

  test('endStroke clears the trail immediately', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 0);
    extendStroke(t, 10, 10, 10, MAX, GAP);
    endStroke(t);
    expect(t.active).toBe(false);
    expect(t.points).toHaveLength(0);
  });

  test('pruneTrail drops old points but always keeps the newest', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 0, 0, 0);
    extendStroke(t, 1, 1, 50, MAX, 1000);
    extendStroke(t, 2, 2, 100, MAX, 1000);
    pruneTrail(t, 120, 60); // keeps t >= 60
    expect(t.points.map(p => p.t)).toEqual([100]);
    pruneTrail(t, 10_000, 60); // everything is old; the head is retained
    expect(t.points.map(p => p.t)).toEqual([100]);
  });
});
