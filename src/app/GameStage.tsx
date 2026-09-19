import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {HandCameraPreview} from 'react-native-hands';
import {GameScreen} from '../game/GameScreen';
import {PauseOverlay} from '../ui/PauseOverlay';
import {CalibrationOverlay} from '../camera/CalibrationOverlay';
import {HandOverlayCanvas} from '../camera/HandOverlayCanvas';
import {androidPermissions} from '../camera/permissions';
import {useHandTracking} from '../camera/useHandTracking';
import {nativeHandsClient, type HandsClient} from '../camera/handsClient';
import type {BladeSet} from '../input/bladeSet';
import type {GameOverReason} from '../game/types';
import {cameraShouldRun, type FlowAction, type FlowState} from './flow';
import type {Haptics} from '../ui/haptics';
import {colors} from '../ui/theme';

interface GameStageProps {
  flow: FlowState;
  dispatch: (action: FlowAction) => void;
  blades: BladeSet;
  /** False while the app is in the background: the camera must be released. */
  appActive: boolean;
  reducedMotion: boolean;
  haptics: Haptics;
  onGameOver: (score: number, reason: GameOverReason) => void;
  client?: HandsClient;
}

/**
 * The game world: calibrating, playing and paused all render here so the
 * running game (its GameScreen, and so its state) survives a pause or a
 * recalibration. In hand mode the camera preview sits BEHIND the transparent
 * game canvas and the camera is bound to `cameraShouldRun`, so leaving hand
 * mode, pausing or backgrounding releases it.
 */
export function GameStage({
  flow,
  dispatch,
  blades,
  appActive,
  reducedMotion,
  haptics,
  onGameOver,
  client = nativeHandsClient,
}: GameStageProps): React.JSX.Element {
  const [size, setSize] = useState<{width: number; height: number} | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize(prev =>
        prev && prev.width === width && prev.height === height ? prev : {width, height},
      );
    }
  }, []);

  const hand = flow.mode === 'hand';
  const cameraOn = hand && cameraShouldRun(flow) && appActive;
  const phase = flow.screen === 'calibrating' ? 'calibrating' : 'playing';

  const tracking = useHandTracking({
    active: cameraOn,
    phase,
    oneHand: flow.oneHand,
    view: size,
    blades,
    client,
    onCalibrated: useCallback(() => dispatch({type: 'CALIBRATED'}), [dispatch]),
    onTrackingLost: useCallback(() => dispatch({type: 'TRACKING_LOST'}), [dispatch]),
    onError: useCallback(
      error => {
        // Startup failures return to setup; mid-game failures pause (with touch offered).
        dispatch({type: 'CAMERA_ERROR', error});
      },
      [dispatch],
    ),
  });

  // Permission can vanish while the app is away (revoked in Settings, or a
  // one-time grant expired). Re-check on return and go back to setup if so.
  useEffect(() => {
    if (!hand || !appActive) {
      return;
    }
    let alive = true;
    androidPermissions
      .check()
      .then(granted => {
        if (alive && !granted) {
          dispatch({type: 'PERMISSION_LOST'});
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hand, appActive, dispatch]);

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {cameraOn ? (
        <HandCameraPreview style={StyleSheet.absoluteFill} scaleType="fill" />
      ) : null}
      {cameraOn && size ? (
        <HandOverlayCanvas adapter={tracking.adapter} width={size.width} height={size.height} />
      ) : null}

      <GameScreen
        key={flow.gameId}
        blades={blades}
        mode={flow.mode}
        difficulty={flow.difficulty}
        running={flow.screen === 'playing' && appActive}
        backdrop={hand ? 'camera' : 'image'}
        bladeCount={flow.oneHand ? 1 : 2}
        reducedMotion={reducedMotion}
        haptics={haptics}
        onGameOver={onGameOver}
        onPause={() => dispatch({type: 'PAUSE', reason: 'user'})}
        showHud={flow.screen !== 'calibrating'}
      />

      {flow.screen === 'calibrating' ? (
        <CalibrationOverlay
          calibration={tracking.ui.calibration}
          status={tracking.ui.status}
          oneHand={flow.oneHand}
          resuming={flow.resuming}
          reducedMotion={reducedMotion}
          onCancel={() => dispatch({type: 'HOME'})}
          onTouch={() => dispatch({type: 'SWITCH_TO_TOUCH'})}
        />
      ) : null}

      {flow.screen === 'paused' && flow.pauseReason ? (
        <PauseOverlay
          reason={flow.pauseReason}
          mode={flow.mode}
          onResume={() => dispatch({type: 'RESUME'})}
          onRestart={() => dispatch({type: 'RESTART'})}
          onHome={() => dispatch({type: 'HOME'})}
          onSwitchToTouch={() => dispatch({type: 'SWITCH_TO_TOUCH'})}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Black behind the preview so nothing else shows through before the first frame.
  stage: {flex: 1, backgroundColor: colors.bg},
});
