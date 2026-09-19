/**
 * @format
 *
 * Lifecycle contract of the hand-tracking session hook, tested against a FAKE
 * client. No camera or detector is involved: these tests prove the app-side
 * rules (start/stop, session handling, calibration, loss). Live-camera behaviour
 * is verified on an emulator/device and recorded in docs/android/TEST_EVIDENCE.md.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {BladeSet} from '../../src/input/bladeSet';
import {
  useHandTracking,
  type UseHandTrackingArgs,
} from '../../src/camera/useHandTracking';
import type {HandsClient} from '../../src/camera/handsClient';

const OFFSET = 500_000;
let now = 0;
const clock = () => now;

function makeClient() {
  const frameListeners = new Set<(e: any) => void>();
  const stateListeners = new Set<(e: any) => void>();
  let session = 0;
  const client: HandsClient = {
    getCapabilities: jest.fn(),
    start: jest.fn(async () => ({sessionId: ++session, lens: 'front', delegate: 'cpu'})),
    stop: jest.fn(async () => undefined),
    getStats: jest.fn(),
    haptic: jest.fn(),
    onHandFrame: jest.fn(l => {
      frameListeners.add(l);
      return () => frameListeners.delete(l);
    }),
    onTrackingState: jest.fn(l => {
      stateListeners.add(l);
      return () => stateListeners.delete(l);
    }),
  };
  return {
    client,
    emitFrame: (e: any) => frameListeners.forEach(l => l(e)),
    emitState: (e: any) => stateListeners.forEach(l => l(e)),
    listeners: () => ({frames: frameListeners.size, states: stateListeners.size}),
  };
}

function lm(hands: Array<[number, number]>): number[] {
  const out: number[] = [];
  for (const [x, y] of hands) {
    const h = new Array(42).fill(0);
    h[16] = x; h[17] = y; h[24] = x; h[25] = y;
    out.push(...h);
  }
  return out;
}

let seq = 0;
function frame(sessionId: number, native: number, hands: Array<[number, number]>) {
  now = native + OFFSET + 20;
  return {
    sessionId,
    seq: ++seq,
    frameTimeMs: native,
    emitTimeMs: native + 15,
    imageWidth: 480,
    imageHeight: 640,
    rotationDegrees: 0,
    lens: 'front',
    inferenceMs: 20,
    handCount: hands.length,
    landmarks: lm(hands),
    handedness: hands.map(() => -1),
    handednessScore: hands.map(() => 0.9),
  };
}

const TWO: Array<[number, number]> = [[0.3, 0.5], [0.7, 0.5]];

let latest: ReturnType<typeof useHandTracking>;
function Harness(props: UseHandTrackingArgs) {
  latest = useHandTracking(props);
  return null;
}

function baseProps(
  client: HandsClient,
  blades: BladeSet,
  over: Partial<UseHandTrackingArgs> = {},
): UseHandTrackingArgs {
  return {
    active: true,
    phase: 'calibrating',
    oneHand: false,
    view: {width: 360, height: 800},
    blades,
    client,
    clock,
    onCalibrated: jest.fn(),
    onTrackingLost: jest.fn(),
    onError: jest.fn(),
    config: {
      calibration: {stableMs: 200, countdownSeconds: 1, graceMs: 250},
      adapter: {tracker: {confirmFrames: 2}},
      pauseAfterLossMs: 500,
      statsLogMs: 0, // keep dev-only console logging out of test output
    },
    ...over,
  };
}

const flush = async () => {
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  now = 0;
  seq = 0;
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function mount(props: UseHandTrackingArgs) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Harness {...props} />);
  });
  return renderer;
}

describe('camera lifecycle', () => {
  test('starts exactly one native session when active, and requests two hands', async () => {
    const {client} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const r = mount(baseProps(client, blades));
    await flush();
    expect(client.start).toHaveBeenCalledTimes(1);
    expect((client.start as jest.Mock).mock.calls[0][0]).toMatchObject({
      lens: 'front',
      numHands: 2,
      delegate: 'cpu',
    });
    ReactTestRenderer.act(() => r.unmount());
  });

  test('one-hand mode requests a single hand', async () => {
    const {client} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const r = mount(baseProps(client, blades, {oneHand: true}));
    await flush();
    expect((client.start as jest.Mock).mock.calls[0][0].numHands).toBe(1);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('turning `active` off releases the camera and removes every listener', async () => {
    const {client, listeners} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush();
    expect(listeners()).toEqual({frames: 1, states: 1});
    expect(client.stop).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => r.update(<Harness {...props} active={false} />));
    expect(client.stop).toHaveBeenCalledTimes(1);
    expect(listeners()).toEqual({frames: 0, states: 0});
    ReactTestRenderer.act(() => r.unmount());
  });

  test('unmounting (leaving hand mode) stops the session', async () => {
    const {client} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const r = mount(baseProps(client, blades));
    await flush();
    ReactTestRenderer.act(() => r.unmount());
    expect(client.stop).toHaveBeenCalledTimes(1);
  });

  test('never active: the camera is never started', async () => {
    const {client} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const r = mount(baseProps(client, blades, {active: false}));
    await flush();
    expect(client.start).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => r.unmount());
  });

  test('changing phase (calibrating -> playing) keeps the same session', async () => {
    const {client} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush();
    ReactTestRenderer.act(() => r.update(<Harness {...props} phase="playing" />));
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(client.stop).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => r.unmount());
  });

  test('rapid restart: stop then start, and late samples of the old session are rejected', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    blades.setOwner('hand');
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush(); // session 1
    ReactTestRenderer.act(() => r.update(<Harness {...props} active={false} />));
    ReactTestRenderer.act(() => r.update(<Harness {...props} active={true} />));
    await flush(); // session 2
    expect(client.start).toHaveBeenCalledTimes(2);

    // A straggler from session 1 arrives after the restart.
    ReactTestRenderer.act(() => emitFrame(frame(1, 1000, TWO)));
    ReactTestRenderer.act(() => emitFrame(frame(1, 1033, TWO)));
    expect(blades.trails.every(t => !t.active)).toBe(true);
    expect(latest.adapter.stats.droppedObsoleteSession).toBe(2);

    // Session 2 samples are accepted.
    ReactTestRenderer.act(() => emitFrame(frame(2, 1066, TWO)));
    ReactTestRenderer.act(() => emitFrame(frame(2, 1099, TWO)));
    expect(latest.adapter.stats.accepted).toBe(2);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('a start failure is reported with its native error code (permission revoked, no camera, ...)', async () => {
    const {client} = makeClient();
    (client.start as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Camera permission is not granted'), {code: 'E_PERMISSION'}),
    );
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush();
    expect(props.onError).toHaveBeenCalledWith({
      code: 'E_PERMISSION',
      message: 'Camera permission is not granted',
    });
    ReactTestRenderer.act(() => r.unmount());
  });

  test('a native error event of the current session is forwarded; other sessions are ignored', async () => {
    const {client, emitState} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush(); // session 1
    ReactTestRenderer.act(() =>
      emitState({sessionId: 7, state: 'error', code: 'E_CAMERA_FATAL', message: 'x', delegate: 'cpu'}),
    );
    expect(props.onError).not.toHaveBeenCalled();
    ReactTestRenderer.act(() =>
      emitState({sessionId: 1, state: 'error', code: 'E_CAMERA_IN_USE', message: 'busy', delegate: 'cpu'}),
    );
    expect(props.onError).toHaveBeenCalledWith({code: 'E_CAMERA_IN_USE', message: 'busy'});
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('calibration and loss', () => {
  test('two stable hands complete calibration exactly once', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush();
    for (let i = 0; i < 60; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    expect(props.onCalibrated).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('one hand never completes a two-hand calibration', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades);
    const r = mount(props);
    await flush();
    for (let i = 0; i < 100; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, [[0.3, 0.5]])));
    }
    expect(props.onCalibrated).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => r.unmount());
  });

  test('losing a required hand during the countdown cancels calibration', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    const props = baseProps(client, blades, {
      config: {
        calibration: {stableMs: 100, countdownSeconds: 3, graceMs: 150},
        adapter: {tracker: {confirmFrames: 2}},
        pauseAfterLossMs: 500,
        statsLogMs: 0, // keep dev-only console logging out of test output
      },
    });
    const r = mount(props);
    await flush();
    for (let i = 0; i < 12; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    // One hand leaves for a long time (well beyond the grace period).
    for (let i = 12; i < 60; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, [[0.3, 0.5]])));
    }
    expect(props.onCalibrated).not.toHaveBeenCalled();
    expect(latest.ui.calibration.phase).toBe('scanning');
    ReactTestRenderer.act(() => r.unmount());
  });

  test('sustained loss while playing is reported once, then again only after hands return and vanish again', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    blades.setOwner('hand');
    const props = baseProps(client, blades, {phase: 'playing'});
    const r = mount(props);
    await flush();
    for (let i = 0; i < 10; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    expect(props.onTrackingLost).not.toHaveBeenCalled();

    // Hands vanish; frames keep arriving with nothing detected (pauseAfterLossMs = 500).
    for (let i = 10; i < 40; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, [])));
    }
    expect(props.onTrackingLost).toHaveBeenCalledTimes(1);
    // Still lost: not reported again.
    for (let i = 40; i < 60; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, [])));
    }
    expect(props.onTrackingLost).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('a brief loss (shorter than the pause threshold) does not pause the game', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    blades.setOwner('hand');
    const props = baseProps(client, blades, {phase: 'playing'});
    const r = mount(props);
    await flush();
    for (let i = 0; i < 10; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    for (let i = 10; i < 16; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, []))); // ~200 ms
    }
    for (let i = 16; i < 30; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    expect(props.onTrackingLost).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => r.unmount());
  });

  test('a frozen camera (no samples at all) clears the blades via the watchdog', async () => {
    const {client, emitFrame} = makeClient();
    const blades = new BladeSet({maxPoints: 20, gapMs: 200, visualTtlMs: 260});
    blades.setOwner('hand');
    const props = baseProps(client, blades, {phase: 'playing'});
    const r = mount(props);
    await flush();
    for (let i = 0; i < 8; i++) {
      ReactTestRenderer.act(() => emitFrame(frame(1, 1000 + i * 33, TWO)));
    }
    expect(blades.trails[0]!.active).toBe(true);
    // No more samples; time passes.
    ReactTestRenderer.act(() => {
      now += 600;
      jest.advanceTimersByTime(600);
    });
    expect(blades.trails.every(t => !t.active && t.points.length === 0)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });
});
