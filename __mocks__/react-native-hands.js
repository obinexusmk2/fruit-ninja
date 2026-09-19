/* eslint-env jest */
// Jest stand-in for the native hand-tracking module. Tests drive it through the
// exported helpers; no camera, detector or native code is involved.
// (Live-camera behaviour is verified on an emulator/device, never here.)
const React = require('react');

let frameListeners = new Set();
let stateListeners = new Set();

const Hands = {
  getCapabilities: jest.fn(async () => ({
    hasFrontCamera: true,
    hasBackCamera: true,
    cameraDisabled: false,
    permissionGranted: true,
    modelPresent: true,
    modelSha256Ok: true,
    modelSha256: 'test',
    sdkInt: 36,
    supportedAbis: ['x86_64'],
    pageSizeBytes: 4096,
    cameraXVersion: 'test',
    mediaPipeVersion: 'test',
  })),
  start: jest.fn(async () => ({sessionId: 1, lens: 'front', delegate: 'cpu'})),
  stop: jest.fn(async () => undefined),
  getStats: jest.fn(async () => ({})),
  haptic: jest.fn(),
  onHandFrame: jest.fn(listener => {
    frameListeners.add(listener);
    return {remove: () => frameListeners.delete(listener)};
  }),
  onTrackingState: jest.fn(listener => {
    stateListeners.add(listener);
    return {remove: () => stateListeners.delete(listener)};
  }),
};

module.exports = {
  Hands,
  HandCameraPreview: props => React.createElement('HandCameraPreview', props),
  __emitFrame: e => [...frameListeners].forEach(l => l(e)),
  __emitState: e => [...stateListeners].forEach(l => l(e)),
  __reset: () => {
    frameListeners = new Set();
    stateListeners = new Set();
  },
};
