/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// The boot screen runs a requestAnimationFrame loop and timed phases. Fake
// timers plus an explicit unmount stop them from firing after Jest tears the
// environment down (which previously crashed the process with exit code 1).
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = (r: ReactTestRenderer.ReactTestRenderer, testID: string) => {
  const node = r.root.find(
    n => n.props.testID === testID && typeof n.props.onPress === 'function',
  );
  ReactTestRenderer.act(() => node.props.onPress());
};

const has = (r: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  r.root.findAll(n => n.props.testID === testID).length > 0;

describe('App flow', () => {
  test('renders the start screen with both play modes', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    expect(has(renderer, 'start-touch')).toBe(true);
    expect(has(renderer, 'start-hand')).toBe(true);
    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  test('touch play needs no camera: start -> boot (skippable) -> playing', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    press(renderer, 'start-touch');
    // Boot screen is showing: tapping it skips straight into the game.
    const boot = renderer.root.find(
      n =>
        n.props.accessibilityLabel === 'Start-up animation. Tap to skip.' &&
        typeof n.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => boot.props.onPress());
    expect(has(renderer, 'touch-surface')).toBe(true);
    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  test('privacy screen opens and closes', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    press(renderer, 'open-privacy');
    expect(has(renderer, 'privacy-back')).toBe(true);
    press(renderer, 'privacy-back');
    expect(has(renderer, 'start-touch')).toBe(true);
    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
