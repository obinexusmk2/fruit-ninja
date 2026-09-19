import React, {memo} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SPRITES} from '../game/assets';

interface HUDProps {
  score: number;
  lives: number;
  livesMax?: number;
  onPause?: () => void;
}

export const PAUSE_BUTTON_SIZE = 52;
/** More lives than this are shown as "icon ×N" instead of one icon per life. */
export const COMPACT_LIVES_ABOVE = 5;

function HUDBase({
  score,
  lives,
  livesMax = 3,
  onPause,
}: HUDProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  // Up to 5 lives are shown as icons; more (Casual has 15) would not fit in a
  // row, so a single icon with a count is used instead.
  const compact = livesMax > COMPACT_LIVES_ABOVE;
  const lifeSlots = compact ? [] : Array.from({length: livesMax}, (_, i) => i);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
        },
      ]}
      pointerEvents="box-none">
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Score ${score}. ${lives} of ${livesMax} lives left.`}
        style={styles.stats}
        pointerEvents="none">
        <Text style={styles.score} maxFontSizeMultiplier={1.3}>
          {score}
        </Text>
        <View style={styles.lives}>
          {compact ? (
            <>
              <Image
                source={SPRITES.apple}
                style={styles.lifeIcon}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.lifeCount} maxFontSizeMultiplier={1.3} testID="hud-lives-count">
                ×{lives}
              </Text>
            </>
          ) : (
            lifeSlots.map(i => (
              <Image
                key={i}
                source={SPRITES.apple}
                style={[styles.lifeIcon, i >= lives && styles.lifeLost]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ))
          )}
        </View>
      </View>

      {onPause ? (
        <Pressable
          onPress={onPause}
          accessibilityRole="button"
          accessibilityLabel="Pause game"
          hitSlop={8}
          style={({pressed}) => [styles.pause, pressed && styles.pausePressed]}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>
      ) : null}
    </View>
  );
}

export const HUD = memo(HUDBase);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stats: {
    flexShrink: 1,
  },
  score: {
    fontFamily: 'monospace',
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
  },
  lives: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  lifeIcon: {
    width: 32,
    height: 32,
    opacity: 1,
  },
  lifeLost: {
    opacity: 0.25,
  },
  lifeCount: {
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    alignSelf: 'center',
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
  },
  pause: {
    width: PAUSE_BUTTON_SIZE,
    height: PAUSE_BUTTON_SIZE,
    borderRadius: PAUSE_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: '#00FFFF',
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pausePressed: {
    backgroundColor: 'rgba(0,255,255,0.35)',
  },
  pauseBar: {
    width: 6,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#00FFFF',
  },
});
