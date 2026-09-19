import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DIFFICULTY_RULES, type Difficulty} from '../game/constants';
import type {GameOverReason} from '../game/types';
import {Button} from './Button';
import {colors, contentColumn, shared} from './theme';

interface GameOverProps {
  score: number;
  reason?: GameOverReason | null;
  difficulty?: Difficulty;
  /** Start another game, optionally at a different difficulty. */
  onRestart: (difficulty?: Difficulty) => void;
  onHome?: () => void;
}

const REASONS: Record<GameOverReason, string> = {
  bomb: 'You sliced a bomb.',
  lives: 'You ran out of lives.',
};

export function GameOver({
  score,
  reason = null,
  difficulty = 'casual',
  onRestart,
  onHome,
}: GameOverProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          contentColumn,
          {paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24},
        ]}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          GAME OVER
        </Text>
        {reason ? (
          <Text style={shared.body} maxFontSizeMultiplier={1.4}>
            {REASONS[reason]}
          </Text>
        ) : null}
        <Text style={styles.label}>FINAL SCORE</Text>
        <Text
          style={styles.score}
          accessibilityLabel={`Final score ${score}`}
          maxFontSizeMultiplier={1.3}>
          {score}
        </Text>
        <View style={styles.buttons}>
          <Button label="Play again" variant="primary" onPress={() => onRestart()} testID="play-again" />
          {/* Stepping up (or back down) is one tap, right where the game ended. */}
          {difficulty === 'challenge' ? (
            <Button
              label={`Back to casual (${DIFFICULTY_RULES.casual.lives} lives)`}
              onPress={() => onRestart('casual')}
              testID="switch-casual"
            />
          ) : (
            <Button
              label={`Try the ${DIFFICULTY_RULES.challenge.lives}-life challenge`}
              onPress={() => onRestart('challenge')}
              testID="switch-challenge"
            />
          )}
          {onHome ? <Button label="Home" onPress={onHome} testID="go-home" /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0000'},
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 44,
    fontWeight: 'bold',
    color: colors.red,
    fontFamily: 'monospace',
    textShadowColor: '#000',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 6,
    textAlign: 'center',
  },
  label: {fontSize: 16, color: '#888', fontFamily: 'monospace', marginTop: 8},
  score: {fontSize: 72, fontWeight: 'bold', color: colors.gold, fontFamily: 'monospace'},
  buttons: {gap: 12, marginTop: 24, alignSelf: 'stretch'},
});
