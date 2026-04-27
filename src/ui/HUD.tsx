import React from 'react';
import {StyleSheet, Text, View, Image} from 'react-native';
import {SPRITES} from '../game/assets';

interface HUDProps {
  score: number;
  lives: number;
}

export function HUD({score, lives}: HUDProps): React.JSX.Element {
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.score}>{score}</Text>
      <View style={styles.lives}>
        {[0, 1, 2].map(i => (
          <Image
            key={i}
            source={SPRITES.apple}
            style={[styles.lifeIcon, i >= lives && styles.lifeLost]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: 20,
  },
  score: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  lives: {
    flexDirection: 'row',
    gap: 6,
  },
  lifeIcon: {
    width: 32,
    height: 32,
    opacity: 1,
  },
  lifeLost: {
    opacity: 0.25,
  },
});
