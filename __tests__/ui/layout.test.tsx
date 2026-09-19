/**
 * @format
 *
 * Adaptive layout (A06): menus keep a readable column on tablets and in
 * landscape, the calibration overlay respects side insets, and no HUD control
 * sits under the calibration overlay.
 */

import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {CalibrationOverlay} from '../../src/camera/CalibrationOverlay';
import {CameraSetupScreen} from '../../src/camera/CameraSetupScreen';
import type {HandsClient} from '../../src/camera/handsClient';
import type {PermissionsApi} from '../../src/camera/permissions';
import type {Capabilities} from 'react-native-hands';
import {GameScreen} from '../../src/game/GameScreen';
import {BladeSet} from '../../src/input/bladeSet';
import type {CalibrationState} from '../../src/input/calibration';
import {GameOver} from '../../src/ui/GameOver';
import {HomeScreen} from '../../src/ui/HomeScreen';
import {PauseOverlay} from '../../src/ui/PauseOverlay';
import {PrivacyScreen} from '../../src/ui/PrivacyScreen';
import {CONTENT_MAX_WIDTH, contentColumn} from '../../src/ui/theme';

const scanning: CalibrationState = {
  phase: 'scanning',
  handsVisible: 0,
  required: 2,
  lockProgress: 0,
  countdownRemaining: 0,
};

type Insets = {top: number; right: number; bottom: number; left: number};
const setInsets = (insets: Insets | undefined) => {
  (globalThis as {__TEST_INSETS__?: Insets}).__TEST_INSETS__ = insets;
};

function render(element: React.ReactElement) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(element);
  });
  return r;
}

/** Style objects of every node (ScrollView content containers included), flattened. */
function styles(r: ReactTestRenderer.ReactTestRenderer) {
  return r.root
    .findAll(n => n.props.style != null || n.props.contentContainerStyle != null)
    .flatMap(n => [n.props.style, n.props.contentContainerStyle])
    .map(s => StyleSheet.flatten(s) as Record<string, unknown> | undefined)
    .filter((s): s is Record<string, unknown> => s != null);
}

const hasColumn = (r: ReactTestRenderer.ReactTestRenderer) =>
  styles(r).some(s => s.maxWidth === CONTENT_MAX_WIDTH && s.width === '100%');

afterEach(() => setInsets(undefined));

describe('readable column on tablets and in landscape', () => {
  test('the column is a phone-sized, centred, full-width-on-phones style', () => {
    expect(contentColumn).toEqual({width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center'});
    expect(CONTENT_MAX_WIDTH).toBeGreaterThanOrEqual(480);
    expect(CONTENT_MAX_WIDTH).toBeLessThanOrEqual(720);
  });

  test('Home', () => {
    const r = render(
      <HomeScreen
        difficulty="casual"
        onDifficultyChange={jest.fn()}
        oneHand={false}
        reducedMotion={false}
        haptics={false}
        onStartTouch={jest.fn()}
        onStartHand={jest.fn()}
        onOneHandChange={jest.fn()}
        onReducedMotionChange={jest.fn()}
        onHapticsChange={jest.fn()}
        onOpenPrivacy={jest.fn()}
      />,
    );
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('Camera setup', async () => {
    const capabilities: Capabilities = {
      hasFrontCamera: true,
      hasBackCamera: true,
      cameraDisabled: false,
      permissionGranted: false,
      modelPresent: true,
      modelSha256Ok: true,
      modelSha256: 'x',
      sdkInt: 36,
      supportedAbis: ['arm64-v8a'],
      pageSizeBytes: 4096,
      cameraXVersion: '1.6.2',
      mediaPipeVersion: '1.0.0',
    };
    const client = {getCapabilities: () => Promise.resolve(capabilities)} as unknown as HandsClient;
    const permissionsApi: PermissionsApi = {
      check: async () => false,
      request: async () => 'denied',
      openSettings: async () => undefined,
    };
    const r = render(
      <CameraSetupScreen
        onReady={jest.fn()}
        onTouch={jest.fn()}
        onBack={jest.fn()}
        runtimeError={null}
        oneHand={false}
        client={client}
        permissionsApi={permissionsApi}
      />,
    );
    await ReactTestRenderer.act(async () => {
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }
    });
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('Pause overlay', () => {
    const r = render(
      <PauseOverlay
        reason="user"
        mode="touch"
        onResume={jest.fn()}
        onRestart={jest.fn()}
        onHome={jest.fn()}
        onSwitchToTouch={jest.fn()}
      />,
    );
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('Game over', () => {
    const r = render(<GameOver score={5} reason="lives" onRestart={jest.fn()} onHome={jest.fn()} />);
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('Privacy', () => {
    const r = render(<PrivacyScreen onBack={jest.fn()} />);
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('Calibration buttons', () => {
    const r = render(
      <CalibrationOverlay
        calibration={scanning}
        status="running"
        oneHand={false}
        resuming={false}
        reducedMotion={false}
        onCancel={jest.fn()}
        onTouch={jest.fn()}
      />,
    );
    expect(hasColumn(r)).toBe(true);
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('calibration overlay and side insets (landscape with a display cutout)', () => {
  test('the status strip and the buttons clear the left and right insets', () => {
    setInsets({top: 24, right: 48, bottom: 20, left: 60});
    const r = render(
      <CalibrationOverlay
        calibration={scanning}
        status="running"
        oneHand={false}
        resuming={false}
        reducedMotion={false}
        onCancel={jest.fn()}
        onTouch={jest.fn()}
      />,
    );
    const padded = styles(r).filter(s => s.paddingLeft === 60 + 16 && s.paddingRight === 48 + 16);
    // the top status strip and the bottom button bar
    expect(padded.length).toBeGreaterThanOrEqual(2);
    ReactTestRenderer.act(() => r.unmount());
  });
});

describe('GameScreen HUD while calibrating', () => {
  const OPTS = {maxPoints: 20, gapMs: 200, visualTtlMs: 260};
  const hudNodes = (r: ReactTestRenderer.ReactTestRenderer) =>
    r.root.findAll(n => typeof n.props.score === 'number' && typeof n.props.lives === 'number');

  function mount(showHud?: boolean) {
    const blades = new BladeSet(OPTS);
    blades.setOwner('hand');
    return render(
      <GameScreen
        blades={blades}
        mode="hand"
        running={false}
        backdrop="camera"
        showHud={showHud}
        onGameOver={jest.fn()}
        onPause={jest.fn()}
      />,
    );
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('is shown by default (playing, paused)', () => {
    const r = mount();
    expect(hudNodes(r).length).toBeGreaterThan(0);
    ReactTestRenderer.act(() => r.unmount());
  });

  test('is not rendered when hidden, so no inert Pause button sits under the overlay', () => {
    const r = mount(false);
    expect(hudNodes(r)).toHaveLength(0);
    expect(r.root.findAll(n => n.props.accessibilityLabel === 'Pause game')).toHaveLength(0);
    ReactTestRenderer.act(() => r.unmount());
  });
});
