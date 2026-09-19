/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {HUD} from '../../src/ui/HUD';
import {GameOver} from '../../src/ui/GameOver';
import {HomeScreen} from '../../src/ui/HomeScreen';
import {GameScreen} from '../../src/game/GameScreen';
import {BladeSet} from '../../src/input/bladeSet';
import {
  flowReducer,
  initialFlow,
  type FlowAction,
} from '../../src/app/flow';

const run = (actions: FlowAction[]) => actions.reduce(flowReducer, initialFlow);

describe('flow: difficulty', () => {
  test('casual (15 lives) is the default', () => {
    expect(initialFlow.difficulty).toBe('casual');
  });

  test('it is chosen on the home screen and kept for the next games', () => {
    const s = run([
      {type: 'SET_DIFFICULTY', value: 'challenge'},
      {type: 'START', mode: 'touch'},
      {type: 'BOOT_DONE'},
    ]);
    expect(s.difficulty).toBe('challenge');
    const over = flowReducer(s, {type: 'GAME_OVER', score: 3, reason: 'lives'});
    expect(over.difficulty).toBe('challenge');
    expect(flowReducer(over, {type: 'RESTART'}).difficulty).toBe('challenge');
    expect(flowReducer(over, {type: 'HOME'}).difficulty).toBe('challenge');
  });

  test('restarting can step up to the 3-life challenge (or back), as a NEW game', () => {
    const over = run([
      {type: 'START', mode: 'touch'},
      {type: 'BOOT_DONE'},
      {type: 'GAME_OVER', score: 20, reason: 'lives'},
    ]);
    const up = flowReducer(over, {type: 'RESTART', difficulty: 'challenge'});
    expect(up).toMatchObject({difficulty: 'challenge', screen: 'playing'});
    expect(up.gameId).toBe(over.gameId + 1);
    const down = flowReducer(
      flowReducer(up, {type: 'GAME_OVER', score: 1, reason: 'bomb'}),
      {type: 'RESTART', difficulty: 'casual'},
    );
    expect(down.difficulty).toBe('casual');
  });

  test('the difficulty cannot change in the middle of a game', () => {
    const playing = run([{type: 'START', mode: 'touch'}, {type: 'BOOT_DONE'}]);
    expect(flowReducer(playing, {type: 'SET_DIFFICULTY', value: 'challenge'})).toBe(playing);
  });
});

describe('HUD lives display', () => {
  // The composite Text and the host node it renders both carry the testID.
  const texts = (r: ReactTestRenderer.ReactTestRenderer) =>
    r.root.findAll(n => n.props.testID === 'hud-lives-count' && typeof n.type === 'string');

  test('15 lives are shown as a compact count, not 15 icons', () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(<HUD score={4} lives={12} livesMax={15} />);
    });
    expect(texts(r)).toHaveLength(1);
    expect([texts(r)[0]!.props.children].flat().join('')).toBe('×12');
    ReactTestRenderer.act(() => r.unmount());
  });

  test('3 lives keep one icon per life (no count)', () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(<HUD score={4} lives={2} livesMax={3} />);
    });
    expect(texts(r)).toHaveLength(0);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('the score/lives label is announced with the real maximum', () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(<HUD score={7} lives={12} livesMax={15} />);
    });
    expect(
      r.root.findAll(n => n.props.accessibilityLabel === 'Score 7. 12 of 15 lives left.').length,
    ).toBeGreaterThan(0);
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('GameOver: one tap to step up or back down', () => {
  const button = (r: ReactTestRenderer.ReactTestRenderer, testID: string) =>
    r.root.findAll(
      n => n.props.testID === testID && typeof n.props.label === 'string',
    );

  test('after a casual game the 3-life challenge is offered', () => {
    const onRestart = jest.fn();
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <GameOver score={31} reason="lives" difficulty="casual" onRestart={onRestart} />,
      );
    });
    expect(button(r, 'switch-casual')).toHaveLength(0);
    ReactTestRenderer.act(() => button(r, 'switch-challenge')[0]!.props.onPress());
    expect(onRestart).toHaveBeenCalledWith('challenge');
    ReactTestRenderer.act(() => button(r, 'play-again')[0]!.props.onPress());
    expect(onRestart).toHaveBeenLastCalledWith(); // same difficulty
    ReactTestRenderer.act(() => r.unmount());
  });

  test('after a challenge game the way back to casual is offered', () => {
    const onRestart = jest.fn();
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <GameOver score={2} reason="bomb" difficulty="challenge" onRestart={onRestart} />,
      );
    });
    expect(button(r, 'switch-challenge')).toHaveLength(0);
    ReactTestRenderer.act(() => button(r, 'switch-casual')[0]!.props.onPress());
    expect(onRestart).toHaveBeenCalledWith('casual');
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('HomeScreen: game type picker', () => {
  const props = {
    oneHand: false,
    reducedMotion: false,
    haptics: false,
    onStartTouch: jest.fn(),
    onStartHand: jest.fn(),
    onOneHandChange: jest.fn(),
    onReducedMotionChange: jest.fn(),
    onHapticsChange: jest.fn(),
    onOpenPrivacy: jest.fn(),
  };

  test('lists Casual (15), Challenge (3) and Practice, with the current choice checked', () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <HomeScreen {...props} difficulty="casual" onDifficultyChange={jest.fn()} />,
      );
    });
    const radio = (id: string) =>
      r.root.findAll(n => n.props.testID === `difficulty-${id}` && n.props.accessibilityRole === 'radio')[0]!;
    expect(radio('casual').props.accessibilityLabel).toMatch(/Casual · 15 lives/);
    expect(radio('challenge').props.accessibilityLabel).toMatch(/Challenge · 3 lives/);
    expect(radio('practice').props.accessibilityLabel).toMatch(/Practice · no bombs/);
    expect(radio('casual').props.accessibilityState).toEqual({checked: true});
    expect(radio('challenge').props.accessibilityState).toEqual({checked: false});
    ReactTestRenderer.act(() => r.unmount());
  });

  test('choosing a type reports it', () => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      r = ReactTestRenderer.create(
        <HomeScreen {...props} difficulty="casual" onDifficultyChange={onChange} />,
      );
    });
    const challenge = r.root.findAll(
      n => n.props.testID === 'difficulty-challenge' && typeof n.props.onPress === 'function',
    )[0]!;
    ReactTestRenderer.act(() => challenge.props.onPress());
    expect(onChange).toHaveBeenCalledWith('challenge');
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('GameScreen: rules and banner', () => {
  const OPTS = {maxPoints: 20, gapMs: 200, visualTtlMs: 260};
  const W = 360;
  const H = 800;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function mountGame(difficulty: 'casual' | 'challenge' | 'practice', rng: () => number) {
    const blades = new BladeSet(OPTS);
    blades.setOwner('touch');
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <GameScreen
          blades={blades}
          mode="touch"
          difficulty={difficulty}
          running
          backdrop="image"
          rng={rng}
          onGameOver={jest.fn()}
        />,
      );
    });
    const container = renderer.root.find(n => typeof n.props.onLayout === 'function');
    ReactTestRenderer.act(() => {
      container.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: W, height: H}}});
    });
    return renderer;
  }

  const hud = (r: ReactTestRenderer.ReactTestRenderer) =>
    r.root.findAll(n => typeof n.props.score === 'number' && typeof n.props.lives === 'number')[0]!.props as {
      score: number;
      lives: number;
      livesMax: number;
    };

  test('casual starts with 15 lives, challenge with 3', () => {
    const casual = mountGame('casual', () => 0.5);
    expect(hud(casual)).toMatchObject({lives: 15, livesMax: 15});
    ReactTestRenderer.act(() => casual.unmount());
    const hard = mountGame('challenge', () => 0.5);
    expect(hud(hard)).toMatchObject({lives: 3, livesMax: 3});
    ReactTestRenderer.act(() => hard.unmount());
  });

  test('slicing three fruit in one swipe shows a COMBO banner and doubles the score', () => {
    // rng 0.7 everywhere: a burst of 3 identical fruit at x = 0.66 W, flying up.
    const r = mountGame('challenge', () => 0.7);
    const surface = r.root.findByProps({testID: 'touch-surface'});
    const send = (handler: string, x: number, y: number) =>
      surface.props[handler]({
        nativeEvent: {changedTouches: [{identifier: 1, locationX: x, locationY: y}]},
      });

    const seen = new Set<string>();
    for (let f = 0; f < 60 * 4; f++) {
      ReactTestRenderer.act(() => {
        if (f === 70) {
          send('onTouchStart', 60, 300);
        } else if (f > 70) {
          // Sweep across the fruit row at y=300 every frame.
          send('onTouchMove', f % 2 === 0 ? 330 : 60, 300);
        }
        jest.advanceTimersByTime(17);
      });
      for (const n of r.root.findAll(x => x.props.testID === 'banner')) {
        seen.add(String(n.props.children));
      }
    }
    expect([...seen].some(t => /^COMBO ×\d+$/.test(t))).toBe(true);
    // 3 identical fruit sliced by one swipe = 2 x 3 points at least.
    expect(hud(r).score).toBeGreaterThanOrEqual(6);
    ReactTestRenderer.act(() => r.unmount());
  });
});
