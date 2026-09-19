import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {CalibrationState} from '../input/calibration';
import {Button} from '../ui/Button';
import {colors, contentColumn} from '../ui/theme';
import type {TrackingStatus} from './useHandTracking';

interface Props {
  calibration: CalibrationState;
  status: TrackingStatus;
  oneHand: boolean;
  /** Calibrating only to resume a game that is already in progress. */
  resuming: boolean;
  reducedMotion: boolean;
  onCancel: () => void;
  onTouch: () => void;
}

/** What the player should do, in one sentence; also announced to screen readers. */
export function calibrationMessage(
  c: CalibrationState,
  status: TrackingStatus,
  oneHand: boolean,
  resuming: boolean,
): string {
  if (status === 'starting') {
    return 'Starting the camera…';
  }
  if (status === 'error' || status === 'stopped') {
    return 'The camera is not available.';
  }
  const hands = oneHand ? 'one hand' : 'both hands';
  switch (c.phase) {
    case 'countdown':
      return `${c.countdownRemaining}`;
    case 'locking':
      return oneHand ? 'Hold still…' : 'Both hands seen. Hold still…';
    case 'done':
      return 'Go!';
    default:
      if (c.handsVisible > 0) {
        return oneHand
          ? 'Move your hand into view'
          : `${c.handsVisible} of ${c.required} hands seen. Raise ${
              c.required - c.handsVisible === 1 ? 'the other one' : 'both'
            }.`;
      }
      return resuming ? `Raise ${hands} to continue` : `Raise ${hands} to begin`;
  }
}

export function CalibrationOverlay({
  calibration,
  status,
  oneHand,
  resuming,
  reducedMotion,
  onCancel,
  onTouch,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const message = calibrationMessage(calibration, status, oneHand, resuming);
  const counting = calibration.phase === 'countdown';

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root]}
      pointerEvents="box-none"
      testID="calibration-overlay">
      <View
        style={[
          styles.top,
          {
            paddingTop: insets.top + 12,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
        pointerEvents="none">
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {resuming ? 'RAISE YOUR HANDS' : 'CALIBRATION'}
        </Text>
        <Text style={styles.hands} maxFontSizeMultiplier={1.3}>
          HANDS DETECTED {calibration.handsVisible} / {calibration.required}
        </Text>
        <View
          style={styles.barTrack}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Hold still progress"
          accessibilityValue={{min: 0, max: 100, now: Math.round(calibration.lockProgress * 100)}}>
          <View style={[styles.barFill, {width: `${Math.round(calibration.lockProgress * 100)}%`}]} />
        </View>
      </View>

      <View style={styles.center} pointerEvents="none">
        <Text
          style={[styles.message, counting && styles.count]}
          accessibilityLiveRegion="assertive"
          maxFontSizeMultiplier={1.3}
          testID="calibration-message">
          {message}
        </Text>
        {!counting && !reducedMotion && status === 'running' && calibration.phase === 'scanning' ? (
          <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
            {oneHand ? '✋' : '🙌'}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 16,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}>
        {/* Buttons keep a phone-sized column on tablets and in landscape. */}
        <View style={[styles.buttons, contentColumn]}>
          <Button label="Play with touch instead" onPress={onTouch} testID="calibration-touch" />
          <Button label="Cancel" variant="danger" onPress={onCancel} testID="calibration-cancel" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {justifyContent: 'space-between'},
  top: {
    paddingBottom: 12,
    gap: 6,
    backgroundColor: 'rgba(0,5,15,0.75)',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.cyan,
    letterSpacing: 3,
  },
  hands: {fontFamily: 'monospace', fontSize: 13, color: colors.text, letterSpacing: 2},
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,255,255,0.15)',
    overflow: 'hidden',
  },
  barFill: {height: '100%', backgroundColor: colors.cyan},
  center: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12},
  message: {
    fontFamily: 'monospace',
    fontSize: 20,
    color: colors.cyan,
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowRadius: 8,
  },
  count: {fontSize: 120, fontWeight: 'bold', color: '#FFC100'},
  emoji: {fontSize: 64},
  bottom: {alignItems: 'center', backgroundColor: 'rgba(0,5,15,0.75)', paddingTop: 12},
  buttons: {gap: 10},
});
