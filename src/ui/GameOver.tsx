import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface GameOverProps {
  score: number;
  onRestart: () => void;
}

export function GameOver({score, onRestart}: GameOverProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GAME OVER</Text>
      <Text style={styles.label}>FINAL SCORE</Text>
      <Text style={styles.score}>{score}</Text>
      <TouchableOpacity style={styles.button} onPress={onRestart} activeOpacity={0.7}>
        <Text style={styles.buttonText}>PLAY AGAIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF3333',
    fontFamily: 'monospace',
    textShadowColor: '#000',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 6,
  },
  label: {
    fontSize: 18,
    color: '#888',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  score: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFD700',
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#FF3333',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    fontFamily: 'monospace',
  },
});
