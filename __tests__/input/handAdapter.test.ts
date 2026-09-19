import {BladeSet} from '../../src/input/bladeSet';
import {ClockSync} from '../../src/input/clockSync';
import {
  DEFAULT_HAND_ADAPTER_OPTIONS,
  HandAdapter,
  type HandFrameLike,
} from '../../src/input/handAdapter';

const OPTS = {maxPoints: 20, gapMs: 200, visualTtlMs: 260};

// The JS clock and the native clock have unrelated origins: JS = native + OFFSET.
const OFFSET = 500_000;
const VIEW = {width: 360, height: 800, fit: 'cover' as const};

let nowJs = 0;
let seq = 0;
const clock = () => nowJs;

/** Native landmarks for `n` hands with fingertip 8 and 12 at the given normalised points. */
function landmarks(hands: Array<[number, number]>): number[] {
  const out: number[] = [];
  for (const [x, y] of hands) {
    const h = new Array(42).fill(0);
    h[8 * 2] = x;
    h[8 * 2 + 1] = y;
    h[12 * 2] = x;
    h[12 * 2 + 1] = y;
    out.push(...h);
  }
  return out;
}

interface FrameOpts {
  sessionId?: number;
  seq?: number;
  /** native time of the frame (ms) */
  frameNative: number;
  /** transport delay from frame to JS receipt (ms) */
  delay?: number;
  hands: Array<[number, number]>;
  lens?: string;
  handedness?: number[];
  /** RAW buffer size and the rotation that makes it upright (default: already-upright 480x640). */
  raw?: {width: number; height: number; rotationDegrees: number};
}

function frame(o: FrameOpts): HandFrameLike {
  const delay = o.delay ?? 30;
  nowJs = o.frameNative + OFFSET + delay; // moment of receipt
  return {
    sessionId: o.sessionId ?? 1,
    seq: o.seq ?? ++seq,
    frameTimeMs: o.frameNative,
    emitTimeMs: o.frameNative + delay - 5, // emitted a bit before receipt
    imageWidth: o.raw?.width ?? 480,
    imageHeight: o.raw?.height ?? 640,
    rotationDegrees: o.raw?.rotationDegrees ?? 0,
    lens: o.lens ?? 'front',
    handCount: o.hands.length,
    landmarks: landmarks(o.hands),
    handedness: o.handedness ?? o.hands.map(() => -1),
  };
}

function setup(over: Partial<typeof DEFAULT_HAND_ADAPTER_OPTIONS> = {}) {
  seq = 0;
  nowJs = 0;
  const blades = new BladeSet(OPTS);
  blades.setOwner('hand');
  const adapter = new HandAdapter(
    blades,
    {...DEFAULT_HAND_ADAPTER_OPTIONS, tracker: {confirmFrames: 2}, ...over},
    clock,
  );
  adapter.setView(VIEW);
  adapter.setSession(1);
  return {blades, adapter};
}

/** Two hands at 30 Hz for `n` frames starting at native time t0. */
function stream(
  adapter: HandAdapter,
  n: number,
  t0: number,
  handsAt: (i: number) => Array<[number, number]>,
) {
  for (let i = 0; i < n; i++) {
    adapter.onFrame(frame({frameNative: t0 + i * 33, hands: handsAt(i)}));
  }
}

const steady: Array<[number, number]> = [
  [0.3, 0.5],
  [0.7, 0.5],
];

describe('HandAdapter: normal operation', () => {
  test('two hands become two independent blades with distinct slots', () => {
    const {blades, adapter} = setup();
    stream(adapter, 6, 1000, i => [
      [0.3 + i * 0.01, 0.5],
      [0.7 - i * 0.01, 0.5],
    ]);
    expect(blades.trails[0]!.active && blades.trails[1]!.active).toBe(true);
    expect(blades.trails[0]!.points.length).toBeGreaterThan(1);
    expect(blades.trails[1]!.points.length).toBeGreaterThan(1);
    expect(adapter.getConfirmedCount()).toBe(2);
    // Slot 0 is the left-most hand (screen x smaller).
    expect(blades.trails[0]!.points[0]!.x).toBeLessThan(blades.trails[1]!.points[0]!.x);
  });

  test('the blade point is the canvas position of the fingertip midpoint (mirrored, cover-cropped)', () => {
    const {blades, adapter} = setup({tracker: {confirmFrames: 1}});
    adapter.onFrame(frame({frameNative: 1000, hands: [[0.25, 0.5]]}));
    // front lens: mirror -> 0.75; cover 360x800 of 480x640: -120 + 0.75*600 = 330; y = 400.
    const p = blades.trails[0]!.points[0]!;
    expect(p.x).toBeCloseTo(330, 3);
    expect(p.y).toBeCloseTo(400, 3);
  });

  // Regression for a bug found with a live camera: MediaPipe reports landmarks in the
  // RAW (landscape, sideways) frame. Treating them as already upright drew the hand
  // skeleton rotated by 90 degrees and stretched. The adapter must rotate them once.
  test.each([
    // raw (0.2, 0.7) in a 640x480 frame, rotate 90 CW => upright (0.3, 0.2), mirror => 0.7,
    // cover 360x800 (x = -120 + 0.7*600 = 300, y = 0.2*800 = 160)
    [90, 300, 160],
    // rotate 270 => upright (0.7, 0.8), mirror => 0.3 => x = -120 + 0.3*600 = 60, y = 640
    [270, 60, 640],
  ] as const)(
    'raw landscape frame rotated %d degrees lands at the right canvas position',
    (rotationDegrees, expectedX, expectedY) => {
      const {blades, adapter} = setup({tracker: {confirmFrames: 1}});
      adapter.onFrame(
        frame({
          frameNative: 1000,
          hands: [[0.2, 0.7]],
          raw: {width: 640, height: 480, rotationDegrees},
        }),
      );
      const p = blades.trails[0]!.points[0]!;
      expect(p.x).toBeCloseTo(expectedX, 3);
      expect(p.y).toBeCloseTo(expectedY, 3);
    },
  );

  test('a raw sideways frame and the equivalent upright frame give the same canvas point', () => {
    const a = setup({tracker: {confirmFrames: 1}});
    a.adapter.onFrame(
      frame({frameNative: 1000, hands: [[0.2, 0.7]], raw: {width: 640, height: 480, rotationDegrees: 90}}),
    );
    const b = setup({tracker: {confirmFrames: 1}});
    b.adapter.onFrame(frame({frameNative: 1000, hands: [[0.3, 0.2]]})); // the same point, already upright
    expect(a.blades.trails[0]!.points[0]!.x).toBeCloseTo(b.blades.trails[0]!.points[0]!.x, 6);
    expect(a.blades.trails[0]!.points[0]!.y).toBeCloseTo(b.blades.trails[0]!.points[0]!.y, 6);
  });

  test('a rotation that is not a multiple of 90 degrees is rejected', () => {
    const {blades, adapter} = setup();
    const r = adapter.onFrame(
      frame({frameNative: 1000, hands: steady, raw: {width: 480, height: 640, rotationDegrees: 45}}),
    );
    expect(r.reason).toBe('invalid');
    expect(blades.trails.every(t => !t.active)).toBe(true);
  });

  test('the back camera is not mirrored', () => {
    const {blades, adapter} = setup({tracker: {confirmFrames: 1}});
    adapter.onFrame(frame({frameNative: 1000, hands: [[0.25, 0.5]], lens: 'back'}));
    expect(blades.trails[0]!.points[0]!.x).toBeCloseTo(-120 + 0.25 * 600, 3);
  });

  test('sample times are on the JS clock (native clock mapped through ClockSync)', () => {
    const {blades, adapter} = setup({tracker: {confirmFrames: 1}});
    for (let i = 0; i < 5; i++) {
      adapter.onFrame(frame({frameNative: 1000 + i * 33, hands: [[0.5, 0.5]]}));
    }
    const last = blades.trails[0]!.points[blades.trails[0]!.points.length - 1]!;
    // frame native 1132 -> approx JS 1132 + OFFSET (within the 5 ms emit/receive skew).
    expect(Math.abs(last.t - (1132 + OFFSET))).toBeLessThan(10);
  });
});

describe('HandAdapter: validation', () => {
  test('samples from another (obsolete) session are dropped', () => {
    const {blades, adapter} = setup();
    const r = adapter.onFrame(frame({sessionId: 99, frameNative: 1000, hands: steady}));
    expect(r).toEqual({accepted: false, reason: 'obsolete-session'});
    expect(blades.trails.every(t => !t.active)).toBe(true);
    expect(adapter.stats.droppedObsoleteSession).toBe(1);
  });

  test('after a restart (new session id) late samples of the old session are rejected', () => {
    const {adapter} = setup();
    stream(adapter, 4, 1000, () => steady);
    adapter.setSession(2);
    const late = adapter.onFrame(frame({sessionId: 1, frameNative: 1200, hands: steady}));
    expect(late.reason).toBe('obsolete-session');
    const fresh = adapter.onFrame(frame({sessionId: 2, frameNative: 1233, hands: steady, seq: 1}));
    expect(fresh.accepted).toBe(true);
  });

  test('a null session accepts nothing', () => {
    const {adapter} = setup();
    adapter.setSession(null);
    expect(adapter.onFrame(frame({frameNative: 1000, hands: steady})).accepted).toBe(false);
  });

  test('duplicate and out-of-order sequence numbers are dropped', () => {
    const {adapter} = setup();
    expect(adapter.onFrame(frame({frameNative: 1000, hands: steady, seq: 10})).accepted).toBe(true);
    expect(adapter.onFrame(frame({frameNative: 1033, hands: steady, seq: 10})).reason).toBe('out-of-order');
    expect(adapter.onFrame(frame({frameNative: 1066, hands: steady, seq: 9})).reason).toBe('out-of-order');
    expect(adapter.onFrame(frame({frameNative: 1099, hands: steady, seq: 11})).accepted).toBe(true);
  });

  test('a frame whose capture time goes backwards is dropped', () => {
    const {adapter} = setup();
    adapter.onFrame(frame({frameNative: 2000, hands: steady}));
    const r = adapter.onFrame(frame({frameNative: 1900, hands: steady, delay: 1}));
    expect(r.reason).toBe('out-of-order');
  });

  test('malformed frames are rejected without touching blades', () => {
    const {blades, adapter} = setup();
    const bad = frame({frameNative: 1000, hands: steady});
    bad.landmarks = Array.from(bad.landmarks).slice(0, 10);
    expect(adapter.onFrame(bad).reason).toBe('invalid');
    const nan = frame({frameNative: 1033, hands: steady});
    nan.frameTimeMs = NaN;
    expect(adapter.onFrame(nan).reason).toBe('invalid');
    expect(blades.trails.every(t => !t.active)).toBe(true);
  });
});

describe('HandAdapter: no phantom slices (loss, staleness, resume)', () => {
  test('the frame a hand disappears its blade is cleared immediately', () => {
    const {blades, adapter} = setup();
    stream(adapter, 5, 1000, () => steady);
    expect(blades.trails[0]!.active && blades.trails[1]!.active).toBe(true);
    // Front camera => mirrored: the hand at native x=0.7 is on the screen's LEFT (slot 0).
    adapter.onFrame(frame({frameNative: 1200, hands: [[0.3, 0.5]]}));
    expect(blades.trails[0]!.active).toBe(false);
    expect(blades.trails[0]!.points).toHaveLength(0);
    expect(blades.trails[1]!.active).toBe(true); // the other hand is unaffected
  });

  test('reacquisition starts a NEW stroke: nothing links the new point to the old stroke', () => {
    const {blades, adapter} = setup({tracker: {confirmFrames: 2, coastMs: 600}});
    stream(adapter, 4, 1000, () => [[0.4, 0.4]]);
    const before = blades.trails[0]!;
    const strokeBefore = before.strokeId;
    const lastBefore = before.points[before.points.length - 1]!;
    adapter.onFrame(frame({frameNative: 1150, hands: []})); // vanishes
    expect(blades.trails[0]!.active).toBe(false);
    // Reappears near where it vanished (within the tracking gate), inside the coast window.
    adapter.onFrame(frame({frameNative: 1300, hands: [[0.45, 0.45]]}));
    const t = blades.trails[0]!;
    expect(t.strokeId).toBeGreaterThan(strokeBefore);
    expect(t.points).toHaveLength(1); // only the new point
    expect(t.points[0]).not.toEqual(lastBefore);
  });

  test('a hand that reappears far from where it vanished is not linked to the old stroke at all', () => {
    const {blades, adapter} = setup({tracker: {confirmFrames: 2, coastMs: 600}});
    stream(adapter, 4, 1000, () => [[0.1, 0.2]]); // top of the frame
    adapter.onFrame(frame({frameNative: 1150, hands: []}));
    // Hands cannot teleport: a detection ~700 px away is a different, unconfirmed hand.
    adapter.onFrame(frame({frameNative: 1300, hands: [[0.9, 0.9]]}));
    expect(blades.trails[0]!.active).toBe(false);
    expect(blades.trails[0]!.points).toHaveLength(0);
    // Once it is stable it starts its own clean stroke.
    adapter.onFrame(frame({frameNative: 1333, hands: [[0.9, 0.9]]}));
    const t = blades.trails.find(tr => tr.active)!;
    expect(t.points).toHaveLength(1);
  });

  test('a stale frame (older than maxSampleAgeMs) is dropped and breaks the blades', () => {
    const {blades, adapter} = setup({maxSampleAgeMs: 250});
    stream(adapter, 5, 1000, () => steady);
    expect(blades.trails[0]!.active).toBe(true);
    const r = adapter.onFrame(frame({frameNative: 1300, hands: steady, delay: 400}));
    expect(r).toEqual({accepted: false, reason: 'stale'});
    expect(blades.trails.every(t => !t.active)).toBe(true);
    expect(adapter.stats.droppedStale).toBe(1);
  });

  test('after a stale burst, the first fresh frame does not bridge from before the stall', () => {
    const {blades, adapter} = setup({maxSampleAgeMs: 250, tracker: {confirmFrames: 2, coastMs: 900}});
    stream(adapter, 4, 1000, () => [[0.4, 0.4]]);
    const stroke = blades.trails[0]!.strokeId;
    adapter.onFrame(frame({frameNative: 1200, hands: [[0.4, 0.4]], delay: 500})); // stale: dropped
    expect(blades.trails[0]!.active).toBe(false);
    // The hand is a little way along when fresh data resumes.
    adapter.onFrame(frame({frameNative: 1600, hands: [[0.5, 0.45]], delay: 30}));
    const t = blades.trails[0]!;
    expect(t.strokeId).toBeGreaterThan(stroke);
    expect(t.points).toHaveLength(1); // a new stroke: no segment across the stall
  });

  test('the watchdog clears blades when samples simply stop arriving', () => {
    const {blades, adapter} = setup({staleMs: 250});
    stream(adapter, 5, 1000, () => steady);
    expect(blades.trails[0]!.active).toBe(true);
    const lastReceipt = nowJs;
    adapter.tick(lastReceipt + 100);
    expect(blades.trails[0]!.active).toBe(true); // within staleMs
    adapter.tick(lastReceipt + 300);
    expect(blades.trails.every(t => !t.active && t.points.length === 0)).toBe(true);
    expect(adapter.getConfirmedCount()).toBe(0);
  });

  test('crossing hands keep their blades (no jump segment between the two hands)', () => {
    const {blades, adapter} = setup();
    let maxJump = 0;
    let prev: Array<{x: number; y: number} | undefined> = [];
    for (let i = 0; i <= 16; i++) {
      const a = 0.2 + i * 0.03;
      const b = 0.8 - i * 0.03;
      adapter.onFrame(frame({frameNative: 1000 + i * 33, hands: [[a, 0.5], [b, 0.5]]}));
      blades.trails.forEach((t, s) => {
        const p = t.points[t.points.length - 1];
        if (p && prev[s]) {
          maxJump = Math.max(maxJump, Math.hypot(p.x - prev[s]!.x, p.y - prev[s]!.y));
        }
        prev[s] = p;
      });
    }
    // Each blade moves ~18 px per frame; a swapped identity would jump hundreds of px.
    expect(maxJump).toBeLessThan(60);
  });

  test('detection order changing between frames does not swap the blades', () => {
    const {blades, adapter} = setup();
    stream(adapter, 4, 1000, () => [[0.3, 0.5], [0.7, 0.5]]);
    const leftX = blades.trails[0]!.points[blades.trails[0]!.points.length - 1]!.x;
    adapter.onFrame(frame({frameNative: 1200, hands: [[0.7, 0.5], [0.3, 0.5]]})); // reversed
    const after = blades.trails[0]!.points[blades.trails[0]!.points.length - 1]!.x;
    expect(Math.abs(after - leftX)).toBeLessThan(5);
  });

  test('resetTracking (e.g. resume after pause) ends strokes and forgets identities', () => {
    const {blades, adapter} = setup();
    stream(adapter, 5, 1000, () => steady);
    adapter.resetTracking();
    expect(blades.trails.every(t => !t.active)).toBe(true);
    expect(adapter.getConfirmedCount()).toBe(0);
    expect(adapter.msSinceAnyHand()).toBeNull();
  });
});

describe('HandAdapter: modes', () => {
  test('one-hand mode drives a single blade even when two hands are visible', () => {
    const {blades, adapter} = setup({oneHand: true});
    stream(adapter, 5, 1000, () => steady);
    expect(blades.trails[0]!.active).toBe(true);
    expect(blades.trails[1]!.active).toBe(false);
    expect(adapter.getConfirmedCount()).toBe(1);
  });

  test('hand samples cannot write blades while touch owns them', () => {
    const {blades, adapter} = setup();
    blades.setOwner('touch');
    stream(adapter, 5, 1000, () => steady);
    expect(blades.trails.every(t => !t.active)).toBe(true);
  });

  test('msSinceAnyHand measures the gap since a confirmed hand was last seen', () => {
    const {adapter} = setup();
    stream(adapter, 5, 1000, () => steady);
    const seen = nowJs;
    expect(adapter.msSinceAnyHand(seen + 100)).toBe(100);
    adapter.onFrame(frame({frameNative: 1200, hands: []}));
    expect(adapter.msSinceAnyHand(nowJs + 400)).toBeGreaterThanOrEqual(400);
  });

  test('the skeleton overlay exposes 21 canvas-space points per detected hand', () => {
    const {adapter} = setup();
    stream(adapter, 4, 1000, () => steady);
    const overlay = adapter.getOverlay()!;
    expect(overlay.hands).toHaveLength(2);
    expect(overlay.hands[0]!.points).toHaveLength(21);
    expect(overlay.hands.every(h => h.confirmed)).toBe(true);
  });

  test('receive age is recorded for the latency statistics', () => {
    const {adapter} = setup();
    stream(adapter, 10, 1000, () => steady);
    expect(adapter.stats.receiveAge.count).toBe(10);
    expect(adapter.stats.receiveAge.average()).toBeLessThan(60);
  });
});

describe('ClockSync', () => {
  test('the minimum (receive - emit) is the offset, so ages never go negative from jitter', () => {
    const c = new ClockSync();
    c.observe(1000, 1000 + OFFSET + 40);
    c.observe(1033, 1033 + OFFSET + 12); // fastest transport
    c.observe(1066, 1066 + OFFSET + 90);
    expect(c.toJs(1100)).toBe(1100 + OFFSET + 12);
  });

  test('ignores non-finite samples and can be reset', () => {
    const c = new ClockSync();
    c.observe(NaN, 5);
    expect(c.ready).toBe(false);
    c.observe(1, 11);
    expect(c.ready).toBe(true);
    c.reset();
    expect(c.ready).toBe(false);
    expect(c.toJs(7)).toBe(7);
  });
});
