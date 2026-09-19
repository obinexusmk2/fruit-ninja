import React, {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import {AppState, BackHandler, StyleSheet, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BootScreen} from './boot/BootScreen';
import {GameStage} from './app/GameStage';
import {CameraSetupScreen} from './camera/CameraSetupScreen';
import {nativeHandsClient} from './camera/handsClient';
import {GameOver} from './ui/GameOver';
import {HomeScreen} from './ui/HomeScreen';
import {PrivacyScreen} from './ui/PrivacyScreen';
import {colors} from './ui/theme';
import {noHaptics, type Haptics} from './ui/haptics';
import {bladeOwner, flowReducer, initialFlow} from './app/flow';
import {BladeSet} from './input/bladeSet';
import {useSettings} from './settings/useSettings';
import {
  STROKE_GAP_MS,
  TRAIL_MAX_POINTS,
  TRAIL_VISUAL_TTL_MS,
} from './game/constants';
import type {GameOverReason} from './game/types';

/** Haptics go through the native module (no VIBRATE permission needed). */
const nativeHaptics: Haptics = {
  slice: () => nativeHandsClient.haptic('slice'),
  bomb: () => nativeHandsClient.haptic('bomb'),
  miss: () => nativeHandsClient.haptic('miss'),
};

function AppContent(): React.JSX.Element {
  const [flow, dispatch] = useReducer(flowReducer, initialFlow);
  const {settings, setReducedMotion, setHaptics} = useSettings();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  // One BladeSet for the whole app: adapters write it, the game reads it.
  const blades = useMemo(
    () =>
      new BladeSet({
        maxPoints: TRAIL_MAX_POINTS,
        gapMs: STROKE_GAP_MS,
        visualTtlMs: TRAIL_VISUAL_TTL_MS,
      }),
    [],
  );

  // Exactly one input mode owns the blades, and only while playing.
  useEffect(() => {
    blades.setOwner(bladeOwner(flow));
  }, [blades, flow]);

  // Backgrounding pauses the game (and, in hand mode, releases the camera).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state !== 'active') {
        dispatch({type: 'PAUSE', reason: 'background'});
      }
    });
    return () => sub.remove();
  }, []);

  // Android Back navigates within the app instead of exiting. On the home
  // screen it is left unhandled so the system can leave the app as usual.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      switch (flow.screen) {
        case 'privacy':
          dispatch({type: 'CLOSE_PRIVACY'});
          return true;
        case 'boot':
          dispatch({type: 'BOOT_DONE'});
          return true;
        case 'playing':
          dispatch({type: 'PAUSE', reason: 'user'});
          return true;
        case 'paused':
          dispatch({type: 'RESUME'});
          return true;
        case 'setup':
        case 'calibrating':
        case 'gameover':
          dispatch({type: 'HOME'});
          return true;
        default:
          return false;
      }
    });
    return () => sub.remove();
  }, [flow.screen]);

  const onGameOver = useCallback((score: number, reason: GameOverReason) => {
    dispatch({type: 'GAME_OVER', score, reason});
  }, []);
  const onBootComplete = useCallback(() => dispatch({type: 'BOOT_DONE'}), []);
  const onCameraReady = useCallback(() => dispatch({type: 'CAMERA_READY'}), []);
  const onSwitchToTouch = useCallback(() => dispatch({type: 'SWITCH_TO_TOUCH'}), []);
  const onHome = useCallback(() => dispatch({type: 'HOME'}), []);

  switch (flow.screen) {
    case 'home':
      return (
        <HomeScreen
          difficulty={flow.difficulty}
          onDifficultyChange={value => dispatch({type: 'SET_DIFFICULTY', value})}
          oneHand={flow.oneHand}
          reducedMotion={settings.reducedMotion}
          haptics={settings.haptics}
          onStartTouch={() => dispatch({type: 'START', mode: 'touch'})}
          onStartHand={() => dispatch({type: 'START', mode: 'hand'})}
          onOneHandChange={value => dispatch({type: 'SET_ONE_HAND', value})}
          onReducedMotionChange={setReducedMotion}
          onHapticsChange={setHaptics}
          onOpenPrivacy={() => dispatch({type: 'OPEN_PRIVACY'})}
        />
      );

    case 'privacy':
      return <PrivacyScreen onBack={() => dispatch({type: 'CLOSE_PRIVACY'})} />;

    case 'boot':
      return (
        <BootScreen
          onBootComplete={onBootComplete}
          reducedMotion={settings.reducedMotion}
        />
      );

    case 'setup':
      return (
        <CameraSetupScreen
          onReady={onCameraReady}
          onTouch={onSwitchToTouch}
          onBack={onHome}
          runtimeError={flow.cameraError}
          oneHand={flow.oneHand}
        />
      );

    case 'calibrating':
    case 'playing':
    case 'paused':
      return (
        <GameStage
          flow={flow}
          dispatch={dispatch}
          blades={blades}
          appActive={appActive}
          reducedMotion={settings.reducedMotion}
          haptics={settings.haptics ? nativeHaptics : noHaptics}
          onGameOver={onGameOver}
        />
      );

    case 'gameover':
      return (
        <GameOver
          score={flow.finalScore}
          reason={flow.gameOverReason}
          difficulty={flow.difficulty}
          onRestart={difficulty => dispatch({type: 'RESTART', difficulty})}
          onHome={onHome}
        />
      );

    default:
      return <View style={styles.game} />;
  }
}

export function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  game: {flex: 1, backgroundColor: colors.bg},
});
