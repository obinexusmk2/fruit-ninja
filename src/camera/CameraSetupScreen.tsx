import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Capabilities} from 'react-native-hands';
import type {CameraErrorInfo} from '../app/flow';
import {Button} from '../ui/Button';
import {colors, contentColumn, shared} from '../ui/theme';
import {nativeHandsClient, type HandsClient} from './handsClient';
import {
  useCameraPermission,
  type PermissionsApi,
} from './permissions';
import {deriveSetupState, type SetupState} from './setupState';

interface CameraSetupScreenProps {
  /** Camera permission is granted and the phone can use the camera: start calibrating. */
  onReady: () => void;
  /** Play with touch instead (available in every state). */
  onTouch: () => void;
  onBack: () => void;
  /** An earlier start attempt failed with this error. */
  runtimeError: CameraErrorInfo | null;
  oneHand: boolean;
  client?: HandsClient;
  permissionsApi?: PermissionsApi;
}

const COPY: Record<SetupState['kind'], {title: string; body: string}> = {
  checking: {
    title: 'CHECKING CAMERA',
    body: 'One moment…',
  },
  'needs-request': {
    title: 'CAMERA ACCESS',
    body: 'Hand mode uses the front camera to see your hands. Pictures are analysed on your phone while you play. They are never saved, recorded or sent anywhere. Tap Allow, then choose "While using the app".',
  },
  requesting: {
    title: 'CAMERA ACCESS',
    body: 'Waiting for your answer to the Android permission prompt…',
  },
  denied: {
    title: 'CAMERA NOT ALLOWED',
    body: 'Without the camera the game cannot see your hands. You can allow it, or play with touch instead. Nothing else changes.',
  },
  blocked: {
    title: 'CAMERA IS OFF',
    body: 'Camera access is turned off for this game in Android Settings. Open Settings > Permissions > Camera and allow it, then come back. Or play with touch.',
  },
  'no-camera': {
    title: 'NO FRONT CAMERA',
    body: 'This phone does not report a front camera, so hand mode is not available. Touch play works everywhere.',
  },
  'camera-disabled': {
    title: 'CAMERA DISABLED',
    body: 'Camera access is switched off on this device (a privacy setting or your organisation). Hand mode is unavailable, but touch play is not affected.',
  },
  'model-error': {
    title: 'HAND TRACKING UNAVAILABLE',
    body: 'The hand-tracking model could not be loaded on this device, so hand mode cannot start. Touch play is not affected.',
  },
  'runtime-error': {
    title: 'CAMERA PROBLEM',
    body: 'The camera could not be started. Another app may be using it. Close other camera apps and try again, or play with touch.',
  },
  ready: {
    title: 'READY',
    body: 'Starting hand mode…',
  },
};

/**
 * Explains why the camera is needed BEFORE any permission prompt, then handles
 * every outcome: granted, denied, permanently denied, no front camera, camera
 * disabled, model failure and runtime camera errors. Touch play is offered in
 * every state.
 */
export function CameraSetupScreen({
  onReady,
  onTouch,
  onBack,
  runtimeError,
  oneHand,
  client = nativeHandsClient,
  permissionsApi,
}: CameraSetupScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const permission = useCameraPermission(permissionsApi);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilitiesFailed, setCapabilitiesFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    client
      .getCapabilities()
      .then(c => alive && setCapabilities(c))
      .catch(() => alive && setCapabilitiesFailed(true));
    return () => {
      alive = false;
    };
  }, [client]);

  const state = deriveSetupState({
    permission: permission.status,
    capabilities,
    capabilitiesFailed,
    runtimeError,
  });

  useEffect(() => {
    if (state.kind === 'ready') {
      onReady();
    }
  }, [state.kind, onReady]);

  const copy = COPY[state.kind];
  const body =
    state.kind === 'runtime-error' ? `${copy.body}\n(${state.code})` : copy.body;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        contentColumn,
        {paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24},
      ]}>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {copy.title}
      </Text>
      <Text
        style={shared.body}
        maxFontSizeMultiplier={1.4}
        accessibilityLiveRegion="polite"
        testID="setup-body">
        {body}
      </Text>

      {state.kind === 'needs-request' ||
      state.kind === 'denied' ||
      state.kind === 'blocked' ||
      state.kind === 'runtime-error' ? (
        <View style={styles.tips}>
          <Text style={shared.dim} maxFontSizeMultiplier={1.4}>
            {oneHand
              ? 'One-hand mode: raise one hand in front of the camera.'
              : 'Stand the phone on a stable surface and keep both hands in view.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.buttons}>
        {state.kind === 'needs-request' || state.kind === 'denied' ? (
          <Button
            label={state.kind === 'denied' ? 'Try again' : 'Allow camera'}
            variant="primary"
            onPress={permission.request}
            testID="setup-allow"
          />
        ) : null}
        {state.kind === 'blocked' ? (
          <Button
            label="Open Settings"
            variant="primary"
            onPress={permission.openSettings}
            testID="setup-settings"
          />
        ) : null}
        {state.kind === 'runtime-error' ? (
          <Button
            label="Try again"
            variant="primary"
            onPress={onReady}
            testID="setup-retry"
          />
        ) : null}
        <Button
          label="Play with touch instead"
          variant={
            state.kind === 'no-camera' ||
            state.kind === 'camera-disabled' ||
            state.kind === 'model-error'
              ? 'primary'
              : 'default'
          }
          onPress={onTouch}
          testID="setup-touch"
        />
        <Button label="Back" onPress={onBack} testID="setup-back" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  content: {paddingHorizontal: 24, gap: 16},
  title: {
    fontFamily: 'monospace',
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.cyan,
    letterSpacing: 3,
  },
  tips: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(0,255,255,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  buttons: {gap: 12, marginTop: 8},
});
