/**
 * @format
 *
 * GameScreen integration tests. These replace the "original defects" harness
 * that reproduced the bugs on commit 20ecffd (its failing output is kept in
 * docs/android/evidence/a02-original-defects-baseline.log): the same scenarios
 * now assert the CORRECT behaviour through the refactored component.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {GameScreen} from '../../src/game/GameScreen';
import {BladeSet} from '../../src/input/bladeSet';

const OPTS = {maxPoints: 20, gapMs: 200, visualTtlMs: 260};
const W = 360;
const H = 800;

function mount(props: Partial<React.ComponentProps<typeof GameScreen>> = {}) {
  const blades = new BladeSet(OPTS);
  blades.setOwner(props.mode ?? 'touch');
  const onGameOver = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <GameScreen
        blades={blades}
        mode="touch"
        running
        backdrop="image"
        onGameOver={onGameOver}
        {...props}
      />,
    );
  });
  const container = renderer.root.find(n => typeof n.props.onLayout === 'function');
  ReactTestRenderer.act(() => {
    container.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: W, height: H}}});
  });
  return {renderer, blades, onGameOver};
}

/** Advances ~16.7 ms per frame for `frames` frames. */
function runFrames(frames: number, each?: (frame: number) => void) {
  for (let f = 0; f < frames; f++) {
    ReactTestRenderer.act(() => {
      each?.(f);
      jest.advanceTimersByTime(17);
    });
  }
}

// HUD is memo()-wrapped, so it is located by the props only it receives.
const hudProps = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(
    n => typeof n.props.score === 'number' && typeof n.props.lives === 'number',
  )[0]!.props as {score: number; lives: number};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('GameScreen', () => {
  test('a bomb that falls off-screen does not cost a life (regression of baseline defect)', () => {
    // rng() === 0.01 forces every spawn to be a bomb (BOMB_CHANCE 0.07).
    const {renderer, onGameOver} = mount({rng: () => 0.01});
    runFrames(60 * 12); // 12 s: several bombs launch and fall
    expect(hudProps(renderer).lives).toBe(3);
    expect(onGameOver).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('missing fruit ends the game exactly once with reason "lives"', () => {
    // rng() === 0.5: every spawn is a coconut flying straight up at x = W/2.
    const {renderer, onGameOver} = mount({rng: () => 0.5});
    runFrames(60 * 20);
    expect(hudProps(renderer).lives).toBe(0);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver).toHaveBeenCalledWith(0, 'lives');
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('a touch swipe slices fruit using canvas-local coordinates and stable ids', () => {
    const {renderer, onGameOver} = mount({rng: () => 0.5});
    const surface = renderer.root.findByProps({testID: 'touch-surface'});

    const touch = (
      handler: string,
      touches: Array<{identifier: number; x: number; y: number}>,
    ) =>
      surface.props[handler]({
        nativeEvent: {
          changedTouches: touches.map(t => ({
            identifier: t.identifier,
            locationX: t.x, // canvas-local
            locationY: t.y,
            pageX: t.x + 500, // deliberately wrong: must NOT be used
            pageY: t.y + 500,
          })),
        },
      });

    // Wait for the first spawn (1 s), then keep swiping across x = W/2 at y = 300.
    runFrames(70);
    ReactTestRenderer.act(() => touch('onTouchStart', [{identifier: 4, x: 100, y: 300}]));
    let scored = 0;
    runFrames(120, f => {
      const x = f % 2 === 0 ? 260 : 100;
      touch('onTouchMove', [{identifier: 4, x, y: 300}]);
    });
    scored = hudProps(renderer).score;
    expect(scored).toBeGreaterThanOrEqual(1);
    expect(onGameOver).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('the clock does not start until sprites are loaded, and a timeout cannot hang the game', () => {
    const skia = require('@shopify/react-native-skia');
    const loaded = () => ({width: () => 1, height: () => 1});
    skia.useImage.mockImplementation(() => null); // sprites never arrive
    try {
      const {renderer, onGameOver} = mount({rng: () => 0.5});
      runFrames(60 * 4); // 4 s < 5 s timeout: the gate is still closed
      expect(hudProps(renderer).lives).toBe(3);
      expect(onGameOver).not.toHaveBeenCalled();
      runFrames(60 * 25); // timeout passes, the game starts and (unplayed) ends
      expect(onGameOver).toHaveBeenCalledTimes(1);
      ReactTestRenderer.act(() => renderer.unmount());
    } finally {
      skia.useImage.mockImplementation(loaded);
    }
  });

  test('the touch surface is not rendered in hand mode (only one input owns the blades)', () => {
    const {renderer} = mount({mode: 'hand', backdrop: 'camera'});
    expect(renderer.root.findAllByProps({testID: 'touch-surface'})).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('pausing stops the loop: no score or lives change while paused', () => {
    const blades = new BladeSet(OPTS);
    blades.setOwner('touch');
    const onGameOver = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const el = (running: boolean) => (
      <GameScreen
        blades={blades}
        mode="touch"
        running={running}
        backdrop="image"
        rng={() => 0.5}
        onGameOver={onGameOver}
      />
    );
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(el(true));
    });
    const container = renderer.root.find(n => typeof n.props.onLayout === 'function');
    ReactTestRenderer.act(() => {
      container.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: W, height: H}}});
    });
    runFrames(60 * 2);
    ReactTestRenderer.act(() => renderer.update(el(false)));
    const before = hudProps(renderer);
    runFrames(60 * 30); // 30 s "paused"
    expect(hudProps(renderer)).toEqual(before);
    expect(onGameOver).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('resuming after a long pause does not fast-forward the game', () => {
    const blades = new BladeSet(OPTS);
    blades.setOwner('touch');
    const onGameOver = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const el = (running: boolean) => (
      <GameScreen
        blades={blades}
        mode="touch"
        running={running}
        backdrop="image"
        rng={() => 0.5}
        onGameOver={onGameOver}
      />
    );
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(el(true));
    });
    const container = renderer.root.find(n => typeof n.props.onLayout === 'function');
    ReactTestRenderer.act(() => {
      container.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: W, height: H}}});
    });
    runFrames(30);
    ReactTestRenderer.act(() => renderer.update(el(false)));
    runFrames(60 * 60); // a full minute paused
    ReactTestRenderer.act(() => renderer.update(el(true)));
    runFrames(5); // a few frames after resume
    // Had the minute been simulated, all lives would be gone.
    expect(hudProps(renderer).lives).toBe(3);
    expect(onGameOver).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });
});
