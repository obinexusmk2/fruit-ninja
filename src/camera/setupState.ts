import type {Capabilities} from 'react-native-hands';
import type {CameraErrorInfo} from '../app/flow';
import type {CameraPermission} from './permissions';

/**
 * Everything the camera setup screen can be showing. Each failure the player
 * can hit has its own state and its own wording, and every state offers touch
 * play as an immediate alternative.
 */
export type SetupState =
  | {kind: 'checking'}
  | {kind: 'needs-request'}
  | {kind: 'requesting'}
  | {kind: 'denied'}
  | {kind: 'blocked'}
  | {kind: 'no-camera'}
  | {kind: 'camera-disabled'}
  | {kind: 'model-error'}
  | {kind: 'runtime-error'; code: string; message: string}
  | {kind: 'ready'};

export interface SetupInputs {
  permission: CameraPermission;
  /** null until the native capability probe has answered. */
  capabilities: Capabilities | null;
  /** The probe itself failed (module missing / native error). */
  capabilitiesFailed: boolean;
  /** A failure reported by an earlier start attempt (see flow.cameraError). */
  runtimeError: CameraErrorInfo | null;
}

export function deriveSetupState(i: SetupInputs): SetupState {
  if (i.capabilitiesFailed) {
    return {kind: 'model-error'};
  }
  const caps = i.capabilities;
  if (!caps) {
    return {kind: 'checking'};
  }
  // Hardware and integrity come first: asking for a permission the phone can
  // never use would only mislead the player.
  if (!caps.hasFrontCamera) {
    return {kind: 'no-camera'};
  }
  if (caps.cameraDisabled) {
    return {kind: 'camera-disabled'};
  }
  if (!caps.modelPresent || !caps.modelSha256Ok) {
    return {kind: 'model-error'};
  }
  if (i.runtimeError) {
    switch (i.runtimeError.code) {
      case 'E_NO_CAMERA':
        return {kind: 'no-camera'};
      case 'E_CAMERA_DISABLED':
        return {kind: 'camera-disabled'};
      case 'E_MODEL':
        return {kind: 'model-error'};
      case 'E_PERMISSION':
        break; // fall through to the permission state
      default:
        return {
          kind: 'runtime-error',
          code: i.runtimeError.code,
          message: i.runtimeError.message,
        };
    }
  }
  switch (i.permission) {
    case 'unknown':
      return {kind: 'checking'};
    case 'needs-request':
      return {kind: 'needs-request'};
    case 'requesting':
      return {kind: 'requesting'};
    case 'denied':
      return {kind: 'denied'};
    case 'blocked':
      return {kind: 'blocked'};
    case 'granted':
      return {kind: 'ready'};
  }
}
