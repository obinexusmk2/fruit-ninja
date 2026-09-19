import {
  nextPermissionState,
  type CameraPermission,
} from '../../src/camera/permissions';
import {deriveSetupState, type SetupInputs} from '../../src/camera/setupState';
import type {Capabilities} from 'react-native-hands';

describe('nextPermissionState', () => {
  test('first check: granted or needs a request', () => {
    expect(nextPermissionState('unknown', {type: 'checked', granted: true})).toBe('granted');
    expect(nextPermissionState('unknown', {type: 'checked', granted: false})).toBe('needs-request');
  });

  test('request outcomes: granted, denied (can ask again), permanently denied', () => {
    const asking = nextPermissionState('needs-request', {type: 'request-started'});
    expect(asking).toBe('requesting');
    expect(nextPermissionState(asking, {type: 'request-result', result: 'granted'})).toBe('granted');
    expect(nextPermissionState(asking, {type: 'request-result', result: 'denied'})).toBe('denied');
    expect(nextPermissionState(asking, {type: 'request-result', result: 'never_ask_again'})).toBe('blocked');
  });

  test('returning from Settings: enabled -> granted; still off -> stays blocked', () => {
    expect(nextPermissionState('blocked', {type: 'checked', granted: true})).toBe('granted');
    expect(nextPermissionState('blocked', {type: 'checked', granted: false})).toBe('blocked');
    expect(nextPermissionState('denied', {type: 'checked', granted: false})).toBe('denied');
  });

  test('a permission revoked while granted (or a one-time grant that expired) must be asked for again', () => {
    expect(nextPermissionState('granted', {type: 'checked', granted: false})).toBe('needs-request');
  });

  test('a re-check while the dialog is showing does not clobber it', () => {
    expect(nextPermissionState('requesting', {type: 'checked', granted: false})).toBe('requesting');
  });

  test('every state is reachable and returns a valid state', () => {
    const states: CameraPermission[] = ['unknown', 'needs-request', 'requesting', 'granted', 'denied', 'blocked'];
    for (const s of states) {
      for (const g of [true, false]) {
        expect(states).toContain(nextPermissionState(s, {type: 'checked', granted: g}));
      }
    }
  });
});

const caps = (over: Partial<Capabilities> = {}): Capabilities => ({
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
  ...over,
});

const inputs = (over: Partial<SetupInputs> = {}): SetupInputs => ({
  permission: 'needs-request',
  capabilities: caps(),
  capabilitiesFailed: false,
  runtimeError: null,
  ...over,
});

describe('deriveSetupState', () => {
  test('waits for the capability probe', () => {
    expect(deriveSetupState(inputs({capabilities: null})).kind).toBe('checking');
    expect(deriveSetupState(inputs({permission: 'unknown'})).kind).toBe('checking');
  });

  test('maps each permission state', () => {
    const kinds = (['needs-request', 'requesting', 'denied', 'blocked', 'granted'] as const).map(
      p => deriveSetupState(inputs({permission: p})).kind,
    );
    expect(kinds).toEqual(['needs-request', 'requesting', 'denied', 'blocked', 'ready']);
  });

  test('no front camera wins over any permission state (do not ask for something unusable)', () => {
    for (const p of ['needs-request', 'denied', 'blocked', 'granted'] as const) {
      expect(
        deriveSetupState(inputs({permission: p, capabilities: caps({hasFrontCamera: false})})).kind,
      ).toBe('no-camera');
    }
  });

  test('camera disabled by policy / privacy toggle', () => {
    expect(
      deriveSetupState(inputs({permission: 'granted', capabilities: caps({cameraDisabled: true})})).kind,
    ).toBe('camera-disabled');
  });

  test('missing or corrupt model, and a failed probe, are model errors', () => {
    expect(deriveSetupState(inputs({capabilities: caps({modelPresent: false})})).kind).toBe('model-error');
    expect(deriveSetupState(inputs({capabilities: caps({modelSha256Ok: false})})).kind).toBe('model-error');
    expect(deriveSetupState(inputs({capabilitiesFailed: true})).kind).toBe('model-error');
  });

  test('runtime errors from an earlier start attempt keep their own state', () => {
    const state = deriveSetupState(
      inputs({permission: 'granted', runtimeError: {code: 'E_CAMERA_IN_USE', message: 'in use'}}),
    );
    expect(state).toEqual({kind: 'runtime-error', code: 'E_CAMERA_IN_USE', message: 'in use'});
    // ...so a granted permission does not loop straight back into a failing start.
    expect(state.kind).not.toBe('ready');
  });

  test('specific runtime error codes map to the matching state', () => {
    const at = (code: string) =>
      deriveSetupState(inputs({permission: 'granted', runtimeError: {code, message: ''}})).kind;
    expect(at('E_NO_CAMERA')).toBe('no-camera');
    expect(at('E_CAMERA_DISABLED')).toBe('camera-disabled');
    expect(at('E_MODEL')).toBe('model-error');
    // A permission error falls back to the permission state.
    expect(at('E_PERMISSION')).toBe('ready');
  });
});
