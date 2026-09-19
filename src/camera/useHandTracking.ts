import {useEffect, useRef, useState} from 'react';
import type {BladeSet} from '../input/bladeSet';
import {
  Calibration,
  DEFAULT_CALIBRATION_CONFIG,
  type CalibrationConfig,
  type CalibrationState,
} from '../input/calibration';
import {
  DEFAULT_HAND_ADAPTER_OPTIONS,
  HandAdapter,
  type HandAdapterOptions,
} from '../input/handAdapter';
import {defaultClock, type Clock} from '../input/types';
import type {CameraErrorInfo} from '../app/flow';
import {
  DEFAULT_START_OPTIONS,
  nativeHandsClient,
  toCameraError,
  type HandsClient,
} from './handsClient';

export type TrackingStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped';

export interface HandTrackingUi {
  status: TrackingStatus;
  calibration: CalibrationState;
  confirmedHands: number;
  delegate: string | null;
}

export interface HandTrackingConfig {
  calibration: Partial<CalibrationConfig>;
  adapter: Partial<HandAdapterOptions>;
  /** No hand for this long while playing pauses the game (ms). */
  pauseAfterLossMs: number;
  /**
   * Log native counters and adapter latency to the console every N ms (0 = off).
   * On by default in development builds only; used for the emulator/device
   * measurements recorded in docs/android/TEST_EVIDENCE.md.
   */
  statsLogMs: number;
}

export const DEFAULT_TRACKING_CONFIG: HandTrackingConfig = {
  calibration: {},
  adapter: {},
  pauseAfterLossMs: 3000,
  statsLogMs: __DEV__ ? 2000 : 0,
};

export interface UseHandTrackingArgs {
  /** The camera runs only while this is true; turning it off releases the camera. */
  active: boolean;
  /** 'calibrating' drives the calibration; 'playing' watches for sustained loss. */
  phase: 'calibrating' | 'playing';
  oneHand: boolean;
  /** Measured size of the view the preview and canvas share (dp). */
  view: {width: number; height: number} | null;
  blades: BladeSet;
  onCalibrated: () => void;
  onTrackingLost: () => void;
  onError: (error: CameraErrorInfo) => void;
  client?: HandsClient;
  clock?: Clock;
  config?: Partial<HandTrackingConfig>;
}

const IDLE_CALIBRATION: CalibrationState = {
  phase: 'scanning',
  handsVisible: 0,
  required: 2,
  lockProgress: 0,
  countdownRemaining: 0,
};

const same = (a: HandTrackingUi, b: HandTrackingUi) =>
  a.status === b.status &&
  a.confirmedHands === b.confirmedHands &&
  a.delegate === b.delegate &&
  a.calibration.phase === b.calibration.phase &&
  a.calibration.handsVisible === b.calibration.handsVisible &&
  a.calibration.required === b.calibration.required &&
  a.calibration.countdownRemaining === b.calibration.countdownRemaining &&
  Math.round(a.calibration.lockProgress * 10) === Math.round(b.calibration.lockProgress * 10);

/**
 * Owns one native hand-tracking session for as long as `active` is true.
 *
 * - Native samples flow: client event -> HandAdapter -> BladeSet (no React
 *   state on the 30 Hz path). React state is refreshed at ~10 Hz for the UI.
 * - Only samples of the session this run started are accepted; when `active`
 *   turns off, or a new run starts, late callbacks from the old run are ignored.
 * - Changing `phase` does NOT restart the camera (calibrating -> playing keeps
 *   the same session); changing `active` or `oneHand` does.
 */
export function useHandTracking(args: UseHandTrackingArgs) {
  const {active, oneHand, view, blades} = args;
  const client = args.client ?? nativeHandsClient;
  const clock = args.clock ?? defaultClock;
  const config = {...DEFAULT_TRACKING_CONFIG, ...args.config};

  const adapterRef = useRef<HandAdapter | null>(null);
  const calibrationRef = useRef<Calibration | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = new HandAdapter(
      blades,
      {...DEFAULT_HAND_ADAPTER_OPTIONS, ...config.adapter, oneHand},
      clock,
    );
  }
  if (!calibrationRef.current) {
    calibrationRef.current = new Calibration({
      ...DEFAULT_CALIBRATION_CONFIG,
      ...config.calibration,
      requiredHands: oneHand ? 1 : 2,
    });
  }
  const adapter = adapterRef.current;
  const calibration = calibrationRef.current;

  // Latest props, read from callbacks without re-creating the session.
  const latest = useRef(args);
  latest.current = args;
  const phaseRef = useRef(args.phase);
  phaseRef.current = args.phase;

  const [ui, setUi] = useState<HandTrackingUi>({
    status: 'idle',
    calibration: IDLE_CALIBRATION,
    confirmedHands: 0,
    delegate: null,
  });
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    adapter.setOptions({...config.adapter, oneHand});
    calibration.setConfig({...config.calibration, requiredHands: oneHand ? 1 : 2});
    // config objects are compared by content through their fields above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, calibration, oneHand]);

  useEffect(() => {
    if (view) {
      adapter.setView({width: view.width, height: view.height, fit: 'cover'});
    }
  }, [adapter, view]);

  useEffect(() => {
    if (!active) {
      setUi(u => (u.status === 'idle' ? u : {...u, status: 'idle', confirmedHands: 0}));
      return;
    }

    let cancelled = false;
    let status: TrackingStatus = 'starting';
    let delegate: string | null = null;
    let calibrated = false;
    let lostFired = false;
    let lastCalibration: CalibrationState = IDLE_CALIBRATION;
    let highestSession = 0;

    adapter.reset();
    calibration.reset();

    const evaluate = () => {
      const now = clock();
      if (phaseRef.current === 'calibrating') {
        lastCalibration = calibration.update(now, adapter.getConfirmedCount());
        if (lastCalibration.phase === 'done' && !calibrated) {
          calibrated = true;
          latest.current.onCalibrated();
        }
      } else {
        const gap = adapter.msSinceAnyHand(now);
        if (adapter.getConfirmedCount() > 0) {
          lostFired = false;
        } else if (gap !== null && gap >= config.pauseAfterLossMs && !lostFired) {
          lostFired = true;
          latest.current.onTrackingLost();
        }
      }
    };

    const syncUi = () => {
      const next: HandTrackingUi = {
        status,
        calibration: lastCalibration,
        confirmedHands: adapter.getConfirmedCount(),
        delegate,
      };
      setUi(prev => (same(prev, next) ? prev : next));
    };

    let lastRawLog = 0;
    const offFrame = client.onHandFrame(event => {
      if (cancelled) {
        return;
      }
      if (config.statsLogMs > 0 && event.handCount > 0) {
        const t = clock();
        if (t - lastRawLog > 2000) {
          lastRawLog = t;
          const lm = event.landmarks;
          // Raw landmark samples (wrist=0, index tip=8, middle tip=12) with the frame
          // geometry: lets the coordinate contract be re-checked from logs.
          console.log(
            '[hands:raw]',
            JSON.stringify({
              raw: `${event.imageWidth}x${event.imageHeight}`,
              rot: event.rotationDegrees,
              lens: event.lens,
              hands: event.handCount,
              wrist: [lm[0], lm[1]],
              index: [lm[16], lm[17]],
              middle: [lm[24], lm[25]],
            }),
          );
        }
      }
      if (adapter.onFrame(event).accepted) {
        evaluate();
      }
    });

    const offState = client.onTrackingState(event => {
      if (cancelled) {
        return;
      }
      if (event.state === 'starting' && event.sessionId > highestSession) {
        // The first event of a session announces its id, so frames that arrive
        // before start() resolves are attributed correctly.
        highestSession = event.sessionId;
        adapter.setSession(event.sessionId);
        return;
      }
      if (event.sessionId !== adapter.getSession()) {
        return; // an old session's late event
      }
      if (event.state === 'running') {
        status = 'running';
      } else if (event.state === 'error') {
        status = 'error';
        latest.current.onError({code: event.code, message: event.message});
      } else if (event.state === 'stopped' && event.code !== 'requested' && event.code !== 'restart') {
        status = 'stopped';
      }
      syncUi();
    });

    client
      .start({
        ...DEFAULT_START_OPTIONS,
        numHands: oneHand ? 1 : 2,
      })
      .then(result => {
        if (cancelled) {
          return;
        }
        highestSession = Math.max(highestSession, result.sessionId);
        adapter.setSession(result.sessionId);
        delegate = result.delegate;
        status = 'running';
        syncUi();
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        status = 'error';
        latest.current.onError(toCameraError(err));
        syncUi();
      });

    // Watchdog + UI refresh: clears stale blades even if no event ever arrives.
    const timer = setInterval(() => {
      adapter.tick();
      evaluate();
      syncUi();
    }, 100);
    const watchdog = setInterval(() => adapter.tick(), 50);
    const statsTimer =
      config.statsLogMs > 0
        ? setInterval(() => {
            Promise.resolve(client.getStats())
              .then(native => {
                const s = adapter.stats;
                console.log(
                  '[hands:stats]',
                  JSON.stringify({
                    native,
                    adapter: {
                      accepted: s.accepted,
                      droppedObsoleteSession: s.droppedObsoleteSession,
                      droppedOutOfOrder: s.droppedOutOfOrder,
                      droppedStale: s.droppedStale,
                      droppedInvalid: s.droppedInvalid,
                      receiveAgeMsAvg: Math.round(s.receiveAge.average() * 10) / 10,
                      receiveAgeMsP95: Math.round(s.receiveAge.percentile(95) * 10) / 10,
                      confirmedHands: adapter.getConfirmedCount(),
                    },
                  }),
                );
              })
              .catch(() => {});
          }, config.statsLogMs)
        : null;
    syncUi();

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(watchdog);
      if (statsTimer) {
        clearInterval(statsTimer);
      }
      offFrame();
      offState();
      adapter.reset();
      // Release the camera and the detector. Idempotent on the native side.
      client.stop().catch(() => {});
      setUi(u => ({...u, status: 'idle', confirmedHands: 0}));
    };
    // The session is bound to `active`, `oneHand` and an explicit retry key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, oneHand, restartKey, client, adapter, calibration, clock]);

  return {
    ui,
    adapter,
    /** Starts a fresh session (retry after an error). */
    restart: () => setRestartKey(k => k + 1),
  };
}
