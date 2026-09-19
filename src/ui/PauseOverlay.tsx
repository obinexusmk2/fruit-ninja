import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {PauseReason} from '../app/flow';
import type {InputMode} from '../input/types';
import {Button} from './Button';
import {colors, shared} from './theme';

interface PauseOverlayProps {
  reason: PauseReason;
  mode: InputMode;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onSwitchToTouch: () => void;
}

const TITLES: Record<PauseReason, string> = {
  user: 'PAUSED',
  background: 'PAUSED',
  'tracking-lost': 'HANDS LOST',
};

export function PauseOverlay({
  reason,
  mode,
  onResume,
  onRestart,
  onHome,
  onSwitchToTouch,
}: PauseOverlayProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const hand = mode === 'hand';
  const detail =
    reason === 'tracking-lost'
      ? 'The camera could not see your hands for a while, so the game paused. Nothing was lost. Raise your hands to continue.'
      : hand
      ? 'The camera is off while paused. Resume to raise your hands again.'
      : 'Your game is on hold.';
  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim]} accessibilityViewIsModal>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24},
        ]}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {TITLES[reason]}
        </Text>
        <Text style={[shared.body, styles.detail]} maxFontSizeMultiplier={1.4}>
          {detail}
        </Text>
        <View style={styles.buttons}>
          <Button
            label={hand ? 'Resume (raise hands)' : 'Resume'}
            variant="primary"
            onPress={onResume}
            testID="pause-resume"
          />
          {hand ? (
            <Button
              label="Play with touch instead"
              onPress={onSwitchToTouch}
              testID="pause-switch-touch"
            />
          ) : null}
          <Button label="Restart" onPress={onRestart} testID="pause-restart" />
          <Button label="Home" variant="danger" onPress={onHome} testID="pause-home" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.cyan,
    letterSpacing: 4,
    textAlign: 'center',
  },
  detail: {textAlign: 'center'},
  buttons: {gap: 12, marginTop: 8},
});
