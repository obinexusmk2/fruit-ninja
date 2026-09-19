import {Calibration, type CalibrationConfig} from '../../src/input/calibration';

const config = (over: Partial<CalibrationConfig> = {}): CalibrationConfig => ({
  requiredHands: 2,
  stableMs: 700,
  countdownSeconds: 3,
  graceMs: 250,
  ...over,
});

describe('Calibration', () => {
  test('stays in scanning until enough hands are visible', () => {
    const c = new Calibration(config());
    expect(c.update(0, 0).phase).toBe('scanning');
    expect(c.update(100, 1).phase).toBe('scanning');
  });

  test('requires STABLE detections before the countdown starts', () => {
    const c = new Calibration(config());
    expect(c.update(0, 2).phase).toBe('locking');
    expect(c.update(400, 2).phase).toBe('locking');
    expect(c.update(400, 2).lockProgress).toBeCloseTo(400 / 700, 6);
    expect(c.update(700, 2).phase).toBe('countdown');
  });

  test('a brief flicker of detection does not start the countdown', () => {
    const c = new Calibration(config());
    c.update(0, 2); // locking
    c.update(200, 0); // hands vanish
    // ...and stay gone longer than the grace period: back to scanning.
    expect(c.update(600, 0).phase).toBe('scanning');
    // Re-acquire: the stable timer starts over, so 700 ms after the ORIGINAL lock is not enough.
    c.update(700, 2);
    expect(c.update(1300, 2).phase).toBe('locking');
    expect(c.update(1400, 2).phase).toBe('countdown');
  });

  test('a short dropout within the grace period does not cancel the lock', () => {
    const c = new Calibration(config({graceMs: 250}));
    c.update(0, 2);
    c.update(300, 1); // one hand lost for a moment
    expect(c.update(450, 1).phase).toBe('locking'); // 150 ms < grace
    expect(c.update(500, 2).phase).toBe('locking');
    expect(c.update(700, 2).phase).toBe('countdown');
  });

  test('countdown counts 3, 2, 1 and then completes', () => {
    const c = new Calibration(config({stableMs: 0}));
    c.update(0, 2); // locking
    const s = c.update(0, 2); // stableMs 0 => countdown
    expect(s.phase).toBe('countdown');
    expect(s.countdownRemaining).toBe(3);
    expect(c.update(1000, 2).countdownRemaining).toBe(2);
    expect(c.update(2000, 2).countdownRemaining).toBe(1);
    expect(c.update(2999, 2).countdownRemaining).toBe(1);
    const done = c.update(3000, 2);
    expect(done.phase).toBe('done');
    expect(c.done).toBe(true);
  });

  test('losing a required hand during the countdown cancels it and restarts calibration', () => {
    const c = new Calibration(config({stableMs: 0, graceMs: 250}));
    c.update(0, 2);
    c.update(0, 2);
    expect(c.update(1000, 2).phase).toBe('countdown');
    c.update(1100, 1); // hand lost
    const cancelled = c.update(1400, 1); // > grace
    expect(cancelled.phase).toBe('scanning');
    expect(cancelled.countdownRemaining).toBe(0);
    // The countdown must start from the top again, after a new stable lock.
    c.update(1500, 2);
    const again = c.update(1500, 2);
    expect(again.phase).toBe('countdown');
    expect(again.countdownRemaining).toBe(3);
  });

  test('one-hand mode needs only one hand', () => {
    const c = new Calibration(config({requiredHands: 1, stableMs: 300}));
    expect(c.update(0, 1).phase).toBe('locking');
    expect(c.update(300, 1).phase).toBe('countdown');
    const two = new Calibration(config({requiredHands: 2}));
    expect(two.update(0, 1).phase).toBe('scanning');
  });

  test('done is terminal until reset', () => {
    const c = new Calibration(config({stableMs: 0, countdownSeconds: 1}));
    c.update(0, 2);
    c.update(0, 2);
    c.update(1000, 2);
    expect(c.done).toBe(true);
    expect(c.update(2000, 0).phase).toBe('done'); // hands leaving after completion changes nothing
    c.reset();
    expect(c.done).toBe(false);
    expect(c.update(2100, 0).phase).toBe('scanning');
  });

  test('timings are configurable at runtime', () => {
    const c = new Calibration(config({stableMs: 5000}));
    c.update(0, 2);
    c.setConfig({stableMs: 100});
    expect(c.update(150, 2).phase).toBe('countdown');
  });
});
