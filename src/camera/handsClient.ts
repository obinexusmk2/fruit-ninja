import type {
  Capabilities,
  HandFrameEvent,
  NativeStats,
  StartOptions,
  StartResult,
  TrackingStateEvent,
} from 'react-native-hands';
import type {CameraErrorInfo} from '../app/flow';

/**
 * The app's view of the native hand-tracking module. Everything above this
 * seam (session hook, adapter, screens) depends only on this interface, so it is
 * tested with a fake; the real implementation below is a thin pass-through.
 */
export interface HandsClient {
  getCapabilities(): Promise<Capabilities>;
  start(options: StartOptions): Promise<StartResult>;
  stop(): Promise<void>;
  getStats(): Promise<NativeStats>;
  haptic(kind: 'slice' | 'bomb' | 'miss'): void;
  onHandFrame(listener: (event: HandFrameEvent) => void): () => void;
  onTrackingState(listener: (event: TrackingStateEvent) => void): () => void;
}

/** Loaded lazily so importing this file never touches the native module. */
function native() {
  return (require('react-native-hands') as typeof import('react-native-hands')).Hands;
}

export const nativeHandsClient: HandsClient = {
  getCapabilities: () => native().getCapabilities(),
  start: options => native().start(options),
  stop: () => native().stop(),
  getStats: () => native().getStats(),
  haptic: kind => native().haptic(kind),
  onHandFrame: listener => {
    const sub = native().onHandFrame(listener);
    return () => sub.remove();
  },
  onTrackingState: listener => {
    const sub = native().onTrackingState(listener);
    return () => sub.remove();
  },
};

/**
 * Defaults mirror the browser version (two hands, 0.65 detection/tracking
 * confidence). CPU is the default delegate: GPU is opt-in until it has been
 * validated on physical devices (see docs/android/PLAN.md).
 */
export const DEFAULT_START_OPTIONS: StartOptions = {
  lens: 'front',
  numHands: 2,
  delegate: 'cpu',
  minDetectionConfidence: 0.65,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.65,
  analysisWidth: 640,
  analysisHeight: 480,
  maxInFlight: 1,
  maxEmitHz: 0,
};

/** Extracts a coded error from a rejected native promise or an error event. */
export function toCameraError(err: unknown): CameraErrorInfo {
  if (err && typeof err === 'object') {
    const e = err as {code?: unknown; message?: unknown};
    return {
      code: typeof e.code === 'string' && e.code ? e.code : 'E_UNKNOWN',
      message: typeof e.message === 'string' ? e.message : 'Unknown camera error',
    };
  }
  return {code: 'E_UNKNOWN', message: String(err)};
}
