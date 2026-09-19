import {BladeSet} from '../../src/input/bladeSet';
import {TouchAdapter, type TouchInput} from '../../src/input/touchAdapter';
import {touchInputFromEvent} from '../../src/input/touchBinding';

const OPTS = {maxPoints: 20, gapMs: 200, visualTtlMs: 260};

function setup(count: 1 | 2 = 2) {
  const blades = new BladeSet(OPTS);
  blades.claim('touch');
  const touch = new TouchAdapter(blades, count);
  return {blades, touch};
}

const down = (id: number, x: number, y: number, t: number): TouchInput => ({
  phase: 'start',
  t,
  changed: [{id, x, y}],
});
const move = (
  t: number,
  ...pts: Array<[number, number, number]>
): TouchInput => ({
  phase: 'move',
  t,
  changed: pts.map(([id, x, y]) => ({id, x, y})),
});
const up = (id: number, t: number): TouchInput => ({
  phase: 'end',
  t,
  changed: [{id, x: 0, y: 0}],
});

describe('TouchAdapter: stable pointer ids', () => {
  test('each pointer keeps its own blade regardless of event ordering', () => {
    const {blades, touch} = setup();
    touch.handle(down(7, 10, 10, 0));
    touch.handle(down(3, 300, 300, 1));

    // The OS may report the two pointers in either order; ids decide the blade.
    touch.handle(move(16, [3, 310, 310], [7, 20, 20]));
    touch.handle(move(32, [7, 30, 30], [3, 320, 320]));

    const a = blades.trails[0]!.points;
    const b = blades.trails[1]!.points;
    expect(a.map(p => [p.x, p.y])).toEqual([[10, 10], [20, 20], [30, 30]]);
    expect(b.map(p => [p.x, p.y])).toEqual([[300, 300], [310, 310], [320, 320]]);
  });

  test('no jump segment is created when the two fingers are reported in swapped order', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 500, 500, 0));
    touch.handle(move(16, [2, 505, 505], [1, 5, 5]));
    for (const trail of blades.trails) {
      for (let i = 1; i < trail.points.length; i++) {
        const d = Math.hypot(
          trail.points[i]!.x - trail.points[i - 1]!.x,
          trail.points[i]!.y - trail.points[i - 1]!.y,
        );
        expect(d).toBeLessThan(10);
      }
    }
  });

  test('lifting one finger leaves the other blade untouched', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 100, 100, 0));
    touch.handle(up(1, 10));
    expect(blades.trails[0]!.active).toBe(false);
    expect(blades.trails[0]!.points).toHaveLength(0);
    expect(blades.trails[1]!.active).toBe(true);
    touch.handle(move(20, [2, 110, 110]));
    expect(blades.trails[1]!.points).toHaveLength(2);
  });

  test('a new finger takes the slot that was freed', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 100, 100, 0));
    touch.handle(up(1, 10));
    touch.handle(down(9, 50, 50, 20));
    expect(blades.trails[0]!.points).toEqual([{x: 50, y: 50, t: 20}]);
  });

  test('a third finger is ignored', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 100, 100, 0));
    touch.handle(down(3, 200, 200, 0));
    touch.handle(move(16, [3, 210, 210]));
    expect(blades.trails.map(t => t.points.length)).toEqual([1, 1]);
  });

  test('one-hand mode uses a single blade and ignores a second finger', () => {
    const {blades, touch} = setup(1);
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 100, 100, 0));
    touch.handle(move(16, [1, 10, 10], [2, 110, 110]));
    expect(blades.trails[0]!.points).toHaveLength(2);
    expect(blades.trails[1]!.active).toBe(false);
  });

  test('cancel ends the stroke like a lift', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle({phase: 'cancel', t: 5, changed: [{id: 1, x: 0, y: 0}]});
    expect(blades.trails[0]!.active).toBe(false);
  });

  test('cancelAll ends every stroke (pause / background)', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 0));
    touch.handle(down(2, 100, 100, 0));
    touch.cancelAll();
    expect(blades.trails.every(t => !t.active && t.points.length === 0)).toBe(true);
    // Later moves for the old pointers do nothing.
    touch.handle(move(50, [1, 5, 5]));
    expect(blades.trails[0]!.points).toHaveLength(0);
  });

  test('a move for an unknown pointer is ignored', () => {
    const {blades, touch} = setup();
    touch.handle(move(10, [42, 5, 5]));
    expect(blades.trails.every(t => !t.active)).toBe(true);
  });

  test('out-of-order timestamps are dropped, not drawn backwards', () => {
    const {blades, touch} = setup();
    touch.handle(down(1, 0, 0, 100));
    touch.handle(move(120, [1, 10, 10]));
    touch.handle(move(110, [1, 99, 99]));
    expect(blades.trails[0]!.points.map(p => p.t)).toEqual([100, 120]);
  });

  test('touches are ignored while another input mode owns the blades', () => {
    const {blades, touch} = setup();
    blades.claim('hand');
    touch.handle(down(1, 0, 0, 0));
    touch.handle(move(16, [1, 10, 10]));
    expect(blades.trails.every(t => !t.active)).toBe(true);
    // ...and switching back to touch starts clean.
    blades.claim('touch');
    touch.handle(down(2, 5, 5, 40));
    expect(blades.trails[0]!.points).toEqual([{x: 5, y: 5, t: 40}]);
  });
});

describe('touchInputFromEvent (React Native binding)', () => {
  test('uses changedTouches, identifier and canvas-local locationX/Y', () => {
    const input = touchInputFromEvent(
      'move',
      {
        changedTouches: [
          {identifier: 5, locationX: 12, locationY: 34, pageX: 999, pageY: 999} as never,
        ],
        // A touches array in a different order must not matter.
        touches: [{identifier: 9, locationX: 1, locationY: 2}],
      } as never,
      77,
    );
    expect(input).toEqual({
      phase: 'move',
      t: 77,
      changed: [{id: 5, x: 12, y: 34}],
    });
  });
});

describe('BladeSet ownership', () => {
  test('claiming a different mode clears the trails', () => {
    const blades = new BladeSet(OPTS);
    blades.claim('touch');
    blades.begin('touch', 0, 1, 1, 0);
    blades.claim('hand');
    expect(blades.trails[0]!.active).toBe(false);
    expect(blades.getOwner()).toBe('hand');
  });

  test('writes from a non-owner are rejected', () => {
    const blades = new BladeSet(OPTS);
    blades.claim('hand');
    expect(blades.begin('touch', 0, 1, 1, 0)).toBe(false);
    expect(blades.extend('touch', 0, 2, 2, 5)).toBe('not-owner');
    expect(blades.begin('hand', 0, 1, 1, 0)).toBe(true);
  });

  test('release only takes effect for the current owner', () => {
    const blades = new BladeSet(OPTS);
    blades.claim('hand');
    blades.begin('hand', 0, 1, 1, 0);
    blades.release('touch');
    expect(blades.getOwner()).toBe('hand');
    expect(blades.trails[0]!.active).toBe(true);
    blades.release('hand');
    expect(blades.getOwner()).toBeNull();
    expect(blades.trails[0]!.active).toBe(false);
  });

  test('prune drops old drawn points', () => {
    const blades = new BladeSet(OPTS);
    blades.claim('touch');
    blades.begin('touch', 0, 0, 0, 0);
    blades.extend('touch', 0, 5, 5, 100);
    blades.extend('touch', 0, 9, 9, 190);
    blades.prune(400); // ttl 260 => keeps t >= 140
    expect(blades.trails[0]!.points.map(p => p.t)).toEqual([190]);
  });
});
