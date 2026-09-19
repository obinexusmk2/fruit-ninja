import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Linking, PermissionsAndroid} from 'react-native';

/**
 * Camera permission states.
 *
 *  unknown       not checked yet
 *  needs-request never asked, or a one-time grant expired / permission revoked
 *  requesting    the system dialog is showing
 *  granted       usable
 *  denied        refused, but Android will still show the dialog again
 *  blocked       "don't ask again": only Settings can grant it now
 */
export type CameraPermission =
  | 'unknown'
  | 'needs-request'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'blocked';

export type PermissionEvent =
  | {type: 'checked'; granted: boolean}
  | {type: 'request-started'}
  | {type: 'request-result'; result: 'granted' | 'denied' | 'never_ask_again'};

/** Pure transition function (unit tested; the hook only feeds it events). */
export function nextPermissionState(
  prev: CameraPermission,
  event: PermissionEvent,
): CameraPermission {
  switch (event.type) {
    case 'checked':
      if (event.granted) {
        return 'granted';
      }
      // Remember a refusal (e.g. returning from Settings without enabling it),
      // but a permission that WAS granted and is now gone (revoked, or a
      // one-time grant that expired) must be requested again from scratch.
      return prev === 'denied' || prev === 'blocked' || prev === 'requesting'
        ? prev
        : 'needs-request';
    case 'request-started':
      return 'requesting';
    case 'request-result':
      return event.result === 'granted'
        ? 'granted'
        : event.result === 'never_ask_again'
        ? 'blocked'
        : 'denied';
  }
}

export interface PermissionsApi {
  check(): Promise<boolean>;
  request(): Promise<'granted' | 'denied' | 'never_ask_again'>;
  openSettings(): Promise<void>;
}

/** React Native's PermissionsAndroid already reports exactly these three results. */
export const androidPermissions: PermissionsApi = {
  check: () => PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
  request: () => PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA),
  openSettings: () => Linking.openSettings(),
};

/**
 * Tracks the camera permission. It re-checks whenever the app returns to the
 * foreground, which is how a return from Settings (granted or not), a revoked
 * permission and an expired one-time grant are all noticed.
 */
export function useCameraPermission(api: PermissionsApi = androidPermissions) {
  const [status, setStatus] = useState<CameraPermission>('unknown');
  const alive = useRef(true);

  const apply = useCallback((event: PermissionEvent) => {
    if (alive.current) {
      setStatus(prev => nextPermissionState(prev, event));
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply({type: 'checked', granted: await api.check()});
    } catch {
      apply({type: 'checked', granted: false});
    }
  }, [api, apply]);

  const request = useCallback(async () => {
    apply({type: 'request-started'});
    try {
      apply({type: 'request-result', result: await api.request()});
    } catch {
      apply({type: 'request-result', result: 'denied'});
    }
  }, [api, apply]);

  const openSettings = useCallback(async () => {
    try {
      await api.openSettings();
    } catch {
      // Nothing more we can do; the screen keeps offering touch play.
    }
  }, [api]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refresh();
      }
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, [refresh]);

  return {status, request, refresh, openSettings};
}
