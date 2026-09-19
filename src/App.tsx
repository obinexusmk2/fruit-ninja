import React, {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import {AppState, BackHandler, StyleSheet, Text, View} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BootScreen} from './boot/BootScreen';
import {GameScreen} from './game/GameScreen';
import {GameOver} from './ui/GameOver';
import {HomeScreen} from './ui/HomeScreen';
import {PauseOverlay} from './ui/PauseOverlay';
import {PrivacyScreen} from './ui/PrivacyScreen';
import {Button} from './ui/Button';
import {colors, shared} from './ui/theme';
import {bladeOwner, flowReducer, initialFlow} from './app/flow';
import {BladeSet} from './input/bladeSet';
import {useSettings} from './settings/useSettings';
import {
  STROKE_GAP_MS,
  TRAIL_MAX_POINTS,
  TRAIL_VISUAL_TTL_MS,
} from './game/constants';
import type {GameOverReason} from './game/types';

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
  const onPause = useCallback(() => dispatch({type: 'PAUSE', reason: 'user'}), []);
  const onBootComplete = useCallback(() => dispatch({type: 'BOOT_DONE'}), []);

  switch (flow.screen) {
    case 'home':
      return (
        <HomeScreen
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
    case 'calibrating':
      // Hand mode screens are provided by the camera module (see src/camera).
      return (
        <View style={styles.center}>
          <Text style={shared.body}>Camera hand mode is not available yet.</Text>
          <Button
            label="Play with touch instead"
            variant="primary"
            onPress={() => dispatch({type: 'SWITCH_TO_TOUCH'})}
          />
        </View>
      );

    case 'playing':
    case 'paused':
      return (
        <View style={styles.game}>
          <GameScreen
            key={flow.gameId}
            blades={blades}
            mode={flow.mode}
            running={flow.screen === 'playing' && appActive}
            backdrop={flow.mode === 'hand' ? 'camera' : 'image'}
            bladeCount={flow.oneHand ? 1 : 2}
            reducedMotion={settings.reducedMotion}
            onGameOver={onGameOver}
            onPause={onPause}
          />
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

    case 'gameover':
      return (
        <GameOver
          score={flow.finalScore}
          reason={flow.gameOverReason}
          onRestart={() => dispatch({type: 'RESTART'})}
          onHome={() => dispatch({type: 'HOME'})}
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
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
});
