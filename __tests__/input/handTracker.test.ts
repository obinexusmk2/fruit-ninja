import {
  DEFAULT_TRACKER_CONFIG,
  HandTracker,
  type Detection,
  type TrackerConfig,
} from '../../src/input/handTracker';

const cfg = (over: Partial<TrackerConfig> = {}): TrackerConfig => ({
  ...DEFAULT_TRACKER_CONFIG,
  confirmFrames: 2,
  matchDistance: 200,
  ...over,
});
const d = (x: number, y: number, handedness = -1): Detection => ({x, y, handedness});

/** Feeds frames at 33 ms spacing and returns the last result. */
function feed(tracker: HandTracker, frames: Detection[][], startT = 0, dt = 33) {
  let last!: ReturnType<HandTracker['update']>;
  frames.forEach((f, i) => {
    last = tracker.update(startT + i * dt, f);
  });
  return last;
}

describe('confirmation', () => {
  test('a track is only confirmed after confirmFrames consecutive detections', () => {
    const t = new HandTracker(cfg({confirmFrames: 3}));
    expect(t.update(0, [d(100, 100)]).confirmedCount).toBe(0);
    expect(t.update(33, [d(101, 100)]).confirmedCount).toBe(0);
    const third = t.update(66, [d(102, 100)]);
    expect(third.confirmedCount).toBe(1);
    expect(third.active[0]!.restart).toBe(true);
  });

  test('a one-frame false detection never becomes a blade', () => {
    const t = new HandTracker(cfg({confirmFrames: 3}));
    t.update(0, [d(100, 100)]);
    const gone = t.update(33, []);
    expect(gone.confirmedCount).toBe(0);
    expect(gone.lost).toHaveLength(0);
    expect(t.getTracks()).toHaveLength(0);
  });

  test('slot 0 goes to the left-most hand when both confirm together', () => {
    const t = new HandTracker(cfg());
    const r = feed(t, [
      [d(300, 200), d(80, 200)],
      [d(300, 200), d(80, 200)],
    ]);
    const bySlot = [...r.active].sort((a, b) => a.slot - b.slot);
    expect(bySlot.map(a => Math.round(a.x))).toEqual([80, 300]);
  });
});

describe('persistent identity', () => {
  test('identity survives a change in detection ORDER', () => {
    const t = new HandTracker(cfg());
    const r1 = feed(t, [
      [d(100, 200), d(300, 200)],
      [d(102, 200), d(302, 200)],
    ]);
    const idAtLeft = r1.active.find(a => Math.abs(a.x - 102) < 5)!.id;
    const idAtRight = r1.active.find(a => Math.abs(a.x - 302) < 5)!.id;
    // Same hands, reversed order in the array.
    const r2 = t.update(66, [d(304, 200), d(104, 200)]);
    expect(r2.active.find(a => Math.abs(a.x - 104) < 5)!.id).toBe(idAtLeft);
    expect(r2.active.find(a => Math.abs(a.x - 304) < 5)!.id).toBe(idAtRight);
  });

  test('hands crossing each other keep their identities (velocity prediction)', () => {
    const t = new HandTracker(cfg({confirmFrames: 2}));
    // Left hand moves right, right hand moves left, along the same line, 25 px per frame.
    const frames: Detection[][] = [];
    for (let i = 0; i <= 16; i++) {
      frames.push([d(100 + i * 25, 300), d(500 - i * 25, 300)]);
    }
    let a: number | null = null;
    let b: number | null = null;
    frames.forEach((f, i) => {
      const r = t.update(i * 33, f);
      if (i === 2) {
        a = r.active.find(x => x.x < 300)!.id;
        b = r.active.find(x => x.x >= 300)!.id;
      }
    });
    // After crossing (positions swapped) the ids must still follow their own hand.
    const final = t.getTracks();
    const trackA = final.find(tr => tr.id === a)!;
    const trackB = final.find(tr => tr.id === b)!;
    expect(trackA.x).toBeCloseTo(100 + 16 * 25, 3); // A ended on the right
    expect(trackB.x).toBeCloseTo(500 - 16 * 25, 3); // B ended on the left
  });

  test('the handedness label only breaks ties; it never overrides position', () => {
    const t = new HandTracker(cfg({labelPenalty: 25}));
    const r = feed(t, [
      [d(100, 200, 0), d(400, 200, 1)],
      [d(100, 200, 0), d(400, 200, 1)],
    ]);
    const idLeft = r.active.find(a => a.x < 200)!.id;
    // The classifier now (wrongly) swaps the labels; positions are unchanged.
    const r2 = t.update(66, [d(101, 200, 1), d(401, 200, 0)]);
    expect(r2.active.find(a => a.x < 200)!.id).toBe(idLeft);
  });

  test('ids are unique and never reused', () => {
    const t = new HandTracker(cfg({coastMs: 100}));
    const ids = new Set<number>();
    for (let round = 0; round < 4; round++) {
      const base = round * 1000;
      const r = feed(t, [[d(100, 100)], [d(100, 100)], [d(100, 100)]], base);
      r.active.forEach(a => ids.add(a.id));
      t.update(base + 500, []); // long loss: track expires
    }
    expect(ids.size).toBe(4);
  });
});

describe('loss and re-acquisition', () => {
  test('the frame a hand disappears it is reported lost so its stroke ends immediately', () => {
    const t = new HandTracker(cfg());
    feed(t, [[d(100, 100)], [d(101, 100)], [d(102, 100)]]);
    const r = t.update(99, []);
    expect(r.lost).toHaveLength(1);
    expect(r.active).toHaveLength(0);
    expect(r.confirmedCount).toBe(0);
    // Not reported again on the next empty frame.
    expect(t.update(132, []).lost).toHaveLength(0);
  });

  test('a brief loss keeps id and slot, and re-acquisition starts a NEW stroke', () => {
    const t = new HandTracker(cfg({coastMs: 400}));
    const before = feed(t, [[d(100, 100)], [d(101, 100)]]);
    const id = before.active[0]!.id;
    const slot = before.active[0]!.slot;
    t.update(66, []); // lost
    t.update(99, []); // still lost
    const back = t.update(132, [d(110, 105)]);
    expect(back.active).toHaveLength(1);
    expect(back.active[0]!.id).toBe(id);
    expect(back.active[0]!.slot).toBe(slot);
    expect(back.active[0]!.restart).toBe(true); // never connect to the pre-loss point
  });

  test('after coastMs the track expires; the returning hand is a new id and a new stroke', () => {
    const t = new HandTracker(cfg({coastMs: 200}));
    const before = feed(t, [[d(100, 100)], [d(101, 100)]]);
    const oldId = before.active[0]!.id;
    const lost = t.update(1000, []);
    expect(lost.expiredIds).toContain(oldId);
    const r = feed(t, [[d(100, 100)], [d(100, 100)]], 1033);
    expect(r.active[0]!.id).not.toBe(oldId);
    expect(r.active[0]!.restart).toBe(true);
  });

  test('a returning hand that is too far from where it vanished is a different hand', () => {
    const t = new HandTracker(cfg({matchDistance: 120, coastMs: 400}));
    const before = feed(t, [[d(100, 100)], [d(101, 100)]]);
    const oldId = before.active[0]!.id;
    t.update(66, []);
    const far = feed(t, [[d(600, 600)], [d(601, 600)]], 99);
    // The old track is still coasting (slot held); with maxHands 2 a second track may form.
    expect(far.active.every(a => a.id !== oldId)).toBe(true);
  });

  test('a fast swipe still matches its own track (gate + prediction)', () => {
    const t = new HandTracker(cfg({matchDistance: 260}));
    const frames: Detection[][] = [];
    for (let i = 0; i < 10; i++) {
      frames.push([d(50 + i * 90, 300)]); // 90 px per 33 ms ~ 2700 px/s
    }
    const r = feed(t, frames);
    expect(r.active).toHaveLength(1);
    expect(t.getTracks()).toHaveLength(1);
  });
});

describe('hand limit', () => {
  test('one-hand mode tracks a single hand and ignores a second one', () => {
    const t = new HandTracker(cfg({maxHands: 1}));
    const r = feed(t, [
      [d(100, 100), d(400, 100)],
      [d(100, 100), d(400, 100)],
      [d(100, 100), d(400, 100)],
    ]);
    expect(r.active).toHaveLength(1);
    expect(r.active[0]!.slot).toBe(0);
    expect(t.getTracks()).toHaveLength(1);
  });

  test('breakAll ends every running stroke and forces a restart', () => {
    const t = new HandTracker(cfg());
    feed(t, [[d(100, 100), d(300, 100)], [d(100, 100), d(300, 100)]]);
    const broken = t.breakAll();
    expect(broken).toHaveLength(2);
    const next = t.update(99, [d(101, 100), d(301, 100)]);
    expect(next.active.every(a => a.restart)).toBe(true);
  });
});
