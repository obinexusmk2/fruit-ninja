import type {CodegenTypes, TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * Typed contract of the native hand-tracking module.
 *
 * Ownership: the native side is the ONLY owner of the camera. JavaScript never
 * opens the camera, never receives image data, and never sees a frame: only
 * small, timestamped landmark samples cross the bridge.
 *
 * Coordinate contract (applied once, in this order, and never twice):
 *  1. Native runs MediaPipe with the frame's rotation, so `landmarks` are
 *     normalised [0..1] in the UPRIGHT (rotation-corrected) analysis image.
 *     `imageWidth`/`imageHeight` are that upright image's pixel size.
 *  2. Native does NOT mirror and does NOT crop. `lens === 'front'` tells JS the
 *     camera preview is displayed mirrored, so JS mirrors x exactly once.
 *  3. JS maps the upright frame into the game viewport (cover/contain crop and
 *     canvas offset). See src/input/transforms.ts in the app.
 */

export type Capabilities = {
  hasFrontCamera: boolean;
  hasBackCamera: boolean;
  /** Best effort: true if the OS reports camera access blocked by policy/privacy. */
  cameraDisabled: boolean;
  permissionGranted: boolean;
  modelPresent: boolean;
  modelSha256Ok: boolean;
  modelSha256: string;
  sdkInt: number;
  supportedAbis: string[];
  pageSizeBytes: number;
  cameraXVersion: string;
  mediaPipeVersion: string;
};

export type StartOptions = {
  /** 'front' (default) or 'back'. */
  lens: string;
  /** 1 or 2. */
  numHands: number;
  /** 'cpu' (default), 'gpu' or 'auto' (GPU, falling back to CPU). */
  delegate: string;
  minDetectionConfidence: number;
  minPresenceConfidence: number;
  minTrackingConfidence: number;
  /** Requested analysis resolution (closest supported 4:3 size is used). */
  analysisWidth: number;
  analysisHeight: number;
  /** Frames allowed inside the detector at once (1 = lowest latency). */
  maxInFlight: number;
  /** Cap on emitted samples per second; 0 = unlimited. */
  maxEmitHz: number;
};

export type StartResult = {
  sessionId: number;
  lens: string;
  /** The delegate actually in use: 'cpu' or 'gpu'. */
  delegate: string;
};

export type HandFrameEvent = {
  /** Samples from any other session id must be discarded. */
  sessionId: number;
  /** Increments by one per emitted sample within a session. */
  seq: number;
  /**
   * Time the frame reached the analyzer on the device's elapsed-realtime clock
   * (ms). This is NOT the sensor exposure time: it excludes exposure, readout
   * and ISP delay, which cannot be measured from application code.
   */
  frameTimeMs: number;
  /** Elapsed-realtime clock (ms) when the sample was handed to JS. */
  emitTimeMs: number;
  imageWidth: number;
  imageHeight: number;
  /** Rotation MediaPipe applied (informational: already applied to landmarks). */
  rotationDegrees: number;
  lens: string;
  /** Milliseconds from submission to result (native inference latency). */
  inferenceMs: number;
  handCount: number;
  /** handCount * 42 numbers: x0, y0, x1, y1, ... for the 21 landmarks of each hand. */
  landmarks: number[];
  /** Per hand: 0 = Left, 1 = Right, -1 = unknown (MediaPipe's label; NOT an identity). */
  handedness: number[];
  /** Per hand: score of the handedness label. NOT a per-landmark confidence. */
  handednessScore: number[];
};

export type TrackingStateEvent = {
  sessionId: number;
  /** 'starting' | 'running' | 'stopped' | 'error' */
  state: string;
  /** Empty unless state is 'error' or 'stopped' with a reason. */
  code: string;
  message: string;
  delegate: string;
};

export type NativeStats = {
  sessionId: number;
  framesReceived: number;
  framesDroppedBusy: number;
  framesSubmitted: number;
  resultsReceived: number;
  resultsObsolete: number;
  samplesEmitted: number;
  errors: number;
  inferenceMsAvg: number;
  inferenceMsP95: number;
  delegate: string;
};

export interface Spec extends TurboModule {
  getCapabilities(): Promise<Capabilities>;
  /** Starts (or restarts) a session. Rejects with a coded error; see docs. */
  start(options: StartOptions): Promise<StartResult>;
  /** Stops the session and releases the camera and the detector. Idempotent. */
  stop(): Promise<void>;
  getStats(): Promise<NativeStats>;
  /** Optional haptic feedback (needs no permission): 'slice' | 'bomb' | 'miss'. */
  haptic(kind: string): void;

  readonly onHandFrame: CodegenTypes.EventEmitter<HandFrameEvent>;
  readonly onTrackingState: CodegenTypes.EventEmitter<TrackingStateEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('FNHands');
