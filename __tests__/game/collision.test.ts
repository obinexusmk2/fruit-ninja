import {
  findTrailHit,
  segmentHitsCircle,
  trailHitsCircle,
} from '../../src/game/collisionDetection';
import {beginStroke, createTrail, extendStroke} from '../../src/game/trail';

// Circle used throughout: centre (100, 100), radius 40.
const C = {x: 100, y: 100, r: 40};
const hit = (ax: number, ay: number, bx: number, by: number) =>
  segmentHitsCircle(ax, ay, bx, by, C.x, C.y, C.r);

describe('segmentHitsCircle', () => {
  test('a segment crossing the disk hits', () => {
    expect(hit(0, 100, 200, 100)).toBe(true);
  });

  test('a segment that starts and ends INSIDE the disk hits (regression: was a miss)', () => {
    expect(hit(90, 100, 110, 100)).toBe(true);
    expect(hit(95, 95, 105, 108)).toBe(true);
  });

  test('a segment that ends inside, or starts inside, hits', () => {
    expect(hit(0, 100, 100, 100)).toBe(true);
    expect(hit(100, 100, 300, 100)).toBe(true);
  });

  test('a segment tangent to the disk hits (closed disk)', () => {
    // y = 60 is exactly r = 40 above the centre.
    expect(hit(0, 60, 200, 60)).toBe(true);
  });

  test('a segment just outside the disk misses', () => {
    expect(hit(0, 59.99, 200, 59.99)).toBe(false);
    expect(hit(0, 20, 200, 20)).toBe(false);
  });

  test('a segment whose supporting line crosses the disk but which stops short misses', () => {
    // Line y=100 passes through the disk, but the segment ends at x=50 (50 > r away).
    expect(hit(0, 100, 50, 100)).toBe(false);
  });

  test('zero-length and sub-minimum segments never hit, even inside the disk', () => {
    expect(hit(100, 100, 100, 100)).toBe(false);
    expect(hit(100, 100, 100.2, 100)).toBe(false); // shorter than MIN_SEGMENT_LENGTH_PX
    expect(hit(100, 100, 101, 100)).toBe(true); // a real (1 px) swipe
  });

  test('a very fast swipe cannot tunnel through the disk between samples', () => {
    // Endpoints are thousands of pixels apart on either side of the fruit.
    expect(hit(-5000, 100, 5000, 100)).toBe(true);
    expect(hit(-5000, 100, 5000, 130)).toBe(true);
    // ...and a long swipe well away from it still misses.
    expect(hit(-5000, 300, 5000, 300)).toBe(false);
  });

  test('non-finite coordinates never hit', () => {
    expect(hit(NaN, 100, 200, 100)).toBe(false);
    expect(hit(0, 100, Infinity, 100)).toBe(false);
    expect(segmentHitsCircle(0, 100, 200, 100, NaN, 100, 40)).toBe(false);
  });

  test('a non-positive radius never hits', () => {
    expect(segmentHitsCircle(0, 100, 200, 100, 100, 100, 0)).toBe(false);
    expect(segmentHitsCircle(0, 100, 200, 100, 100, 100, -5)).toBe(false);
  });
});

describe('findTrailHit / trailHitsCircle (sample-time expiry)', () => {
  const WINDOW = 120;

  function trailWith(points: Array<[number, number, number]>) {
    const t = createTrail(0, '#0ff');
    beginStroke(t, points[0]![0], points[0]![1], points[0]![2]);
    for (const p of points.slice(1)) {
      extendStroke(t, p[0], p[1], p[2], 20, 1000);
    }
    return t;
  }

  test('returns the index of the newer endpoint of the first hitting segment', () => {
    const t = trailWith([
      [0, 0, 0],
      [10, 0, 10],
      [0, 100, 20],
      [200, 100, 30],
    ]);
    expect(findTrailHit(t, 30, WINDOW, 100, 100, 40)).toBe(3);
  });

  test('a segment older than the collision window no longer slices', () => {
    const t = trailWith([
      [0, 100, 0],
      [200, 100, 10],
    ]);
    expect(trailHitsCircle(t, 10, WINDOW, 100, 100, 40)).toBe(true);
    expect(trailHitsCircle(t, 10 + WINDOW, WINDOW, 100, 100, 40)).toBe(true); // boundary
    expect(trailHitsCircle(t, 10 + WINDOW + 1, WINDOW, 100, 100, 40)).toBe(false);
    // A held blade (no new samples) stops slicing as time passes.
    expect(trailHitsCircle(t, 10_000, WINDOW, 100, 100, 40)).toBe(false);
  });

  test('only the recent part of a trail is tested', () => {
    const t = trailWith([
      [0, 100, 0], // old swipe through the fruit
      [200, 100, 10],
      [300, 300, 400], // recent, far away
      [320, 320, 410],
    ]);
    expect(trailHitsCircle(t, 410, WINDOW, 100, 100, 40)).toBe(false);
  });

  test('an inactive trail never hits', () => {
    const t = trailWith([
      [0, 100, 0],
      [200, 100, 10],
    ]);
    t.active = false;
    expect(trailHitsCircle(t, 10, WINDOW, 100, 100, 40)).toBe(false);
  });

  test('a single-point trail has no segment', () => {
    const t = createTrail(0, '#0ff');
    beginStroke(t, 100, 100, 0);
    expect(trailHitsCircle(t, 0, WINDOW, 100, 100, 40)).toBe(false);
  });
});
