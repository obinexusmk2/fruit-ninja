import React, {useState, useCallback} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BootScreen} from './boot/BootScreen';
import {GameScreen} from './game/GameScreen';
import {GameOver} from './ui/GameOver';

type Screen = 'boot' | 'game' | 'gameover';

export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('boot');
  const [finalScore, setFinalScore] = useState(0);

  const onBootComplete = useCallback(() => setScreen('game'), []);

  const onGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setScreen('gameover');
  }, []);

  const onRestart = useCallback(() => setScreen('game'), []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        {screen === 'boot' && <BootScreen onBootComplete={onBootComplete} />}
        {screen === 'game' && <GameScreen onGameOver={onGameOver} />}
        {screen === 'gameover' && (
          <GameOver score={finalScore} onRestart={onRestart} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
