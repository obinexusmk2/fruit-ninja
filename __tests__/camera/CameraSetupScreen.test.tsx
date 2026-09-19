/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {CameraSetupScreen} from '../../src/camera/CameraSetupScreen';
import type {HandsClient} from '../../src/camera/handsClient';
import type {PermissionsApi} from '../../src/camera/permissions';
import type {Capabilities} from 'react-native-hands';

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

function fakeClient(c: Capabilities | Error): HandsClient {
  return {
    getCapabilities: jest.fn(() => (c instanceof Error ? Promise.reject(c) : Promise.resolve(c))),
  } as unknown as HandsClient;
}

function fakePermissions(initiallyGranted: boolean, requestResult: 'granted' | 'denied' | 'never_ask_again') {
  let granted = initiallyGranted;
  const api: PermissionsApi = {
    check: jest.fn(async () => granted),
    request: jest.fn(async () => {
      if (requestResult === 'granted') {
        granted = true;
      }
      return requestResult;
    }),
    openSettings: jest.fn(async () => undefined),
  };
  return api;
}

const flush = async () => {
  await ReactTestRenderer.act(async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  });
};

// One node per app Button: the composite carries `label`; the Pressable it renders does not.
const find = (r: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  r.root.findAll(
    n =>
      n.props.testID === testID &&
      typeof n.props.label === 'string' &&
      typeof n.props.onPress === 'function',
  );
const bodyText = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.find(n => n.props.testID === 'setup-body' && typeof n.props.children === 'string').props.children as string;

async function mount(
  client: HandsClient,
  permissions: PermissionsApi,
  extra: {runtimeError?: {code: string; message: string} | null} = {},
) {
  const onReady = jest.fn();
  const onTouch = jest.fn();
  const onBack = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CameraSetupScreen
        onReady={onReady}
        onTouch={onTouch}
        onBack={onBack}
        runtimeError={extra.runtimeError ?? null}
        oneHand={false}
        client={client}
        permissionsApi={permissions}
      />,
    );
  });
  await flush();
  return {renderer, onReady, onTouch, onBack};
}

describe('CameraSetupScreen', () => {
  test('explains before asking: no permission request is issued until the player taps Allow', async () => {
    const perms = fakePermissions(false, 'granted');
    const {renderer, onReady} = await mount(fakeClient(caps()), perms);
    expect(bodyText(renderer)).toMatch(/never saved|analysed on your phone/i);
    expect(perms.request).not.toHaveBeenCalled();
    expect(find(renderer, 'setup-allow')).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      find(renderer, 'setup-allow')[0]!.props.onPress();
    });
    await flush();
    expect(perms.request).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalled(); // granted -> continue to calibration
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('already granted: continues without showing a prompt', async () => {
    const perms = fakePermissions(true, 'granted');
    const {renderer, onReady} = await mount(fakeClient(caps({permissionGranted: true})), perms);
    expect(onReady).toHaveBeenCalled();
    expect(perms.request).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('denied: explains, offers Try again and touch play', async () => {
    const perms = fakePermissions(false, 'denied');
    const {renderer, onReady, onTouch} = await mount(fakeClient(caps()), perms);
    await ReactTestRenderer.act(async () => {
      find(renderer, 'setup-allow')[0]!.props.onPress();
    });
    await flush();
    expect(onReady).not.toHaveBeenCalled();
    expect(bodyText(renderer)).toMatch(/without the camera/i);
    expect(find(renderer, 'setup-allow')).toHaveLength(1); // "Try again"
    ReactTestRenderer.act(() => find(renderer, 'setup-touch')[0]!.props.onPress());
    expect(onTouch).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('permanently denied: offers Settings (and touch), and never asks again', async () => {
    const perms = fakePermissions(false, 'never_ask_again');
    const {renderer, onTouch} = await mount(fakeClient(caps()), perms);
    await ReactTestRenderer.act(async () => {
      find(renderer, 'setup-allow')[0]!.props.onPress();
    });
    await flush();
    expect(find(renderer, 'setup-allow')).toHaveLength(0);
    expect(bodyText(renderer)).toMatch(/Settings/);
    await ReactTestRenderer.act(async () => {
      find(renderer, 'setup-settings')[0]!.props.onPress();
    });
    expect(perms.openSettings).toHaveBeenCalledTimes(1);
    expect(perms.request).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => find(renderer, 'setup-touch')[0]!.props.onPress());
    expect(onTouch).toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('no front camera: no permission request is offered, touch is the primary action', async () => {
    const perms = fakePermissions(false, 'granted');
    const {renderer} = await mount(fakeClient(caps({hasFrontCamera: false})), perms);
    expect(bodyText(renderer)).toMatch(/does not report a front camera/i);
    expect(find(renderer, 'setup-allow')).toHaveLength(0);
    expect(find(renderer, 'setup-touch')).toHaveLength(1);
    expect(perms.request).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('camera disabled by device policy is explained', async () => {
    const {renderer} = await mount(
      fakeClient(caps({cameraDisabled: true})),
      fakePermissions(false, 'granted'),
    );
    expect(bodyText(renderer)).toMatch(/switched off on this device/i);
    expect(find(renderer, 'setup-allow')).toHaveLength(0);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('model failure (missing/corrupt/probe error) keeps touch play available', async () => {
    const {renderer, onTouch} = await mount(
      fakeClient(caps({modelSha256Ok: false})),
      fakePermissions(false, 'granted'),
    );
    expect(bodyText(renderer)).toMatch(/model could not be loaded/i);
    ReactTestRenderer.act(() => find(renderer, 'setup-touch')[0]!.props.onPress());
    expect(onTouch).toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());

    const failed = await mount(fakeClient(new Error('module missing')), fakePermissions(false, 'granted'));
    expect(bodyText(failed.renderer)).toMatch(/model could not be loaded/i);
    ReactTestRenderer.act(() => failed.renderer.unmount());
  });

  test('a runtime camera error shows its code and offers a retry and touch', async () => {
    const perms = fakePermissions(true, 'granted');
    const {renderer, onReady} = await mount(fakeClient(caps({permissionGranted: true})), perms, {
      runtimeError: {code: 'E_CAMERA_IN_USE', message: 'Camera is in use'},
    });
    expect(bodyText(renderer)).toMatch(/E_CAMERA_IN_USE/);
    expect(onReady).not.toHaveBeenCalled(); // must not loop back into the failing start
    expect(find(renderer, 'setup-retry')).toHaveLength(1);
    ReactTestRenderer.act(() => find(renderer, 'setup-retry')[0]!.props.onPress());
    expect(onReady).toHaveBeenCalledTimes(1);
    ReactTestRenderer.act(() => renderer.unmount());
  });

  test('touch and back are available in every state', async () => {
    for (const c of [
      caps(),
      caps({hasFrontCamera: false}),
      caps({cameraDisabled: true}),
      caps({modelPresent: false}),
    ]) {
      const {renderer} = await mount(fakeClient(c), fakePermissions(false, 'denied'));
      expect(find(renderer, 'setup-touch')).toHaveLength(1);
      expect(find(renderer, 'setup-back')).toHaveLength(1);
      ReactTestRenderer.act(() => renderer.unmount());
    }
  });
});
