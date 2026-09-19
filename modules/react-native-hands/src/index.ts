import NativeFNHands from './specs/NativeFNHands';
import HandCameraPreview from './specs/FNHandCameraPreviewNativeComponent';

export type {
  Capabilities,
  HandFrameEvent,
  NativeStats,
  StartOptions,
  StartResult,
  TrackingStateEvent,
} from './specs/NativeFNHands';

/** The native module. Owns the camera; JavaScript never sees frames. */
export const Hands = NativeFNHands;

/** Native camera preview (a CameraX PreviewView). Render it behind the game canvas. */
export {HandCameraPreview};
