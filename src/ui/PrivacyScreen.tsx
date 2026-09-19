import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button} from './Button';
import {colors, shared} from './theme';

interface PrivacyScreenProps {
  onBack: () => void;
}

/**
 * In-app privacy summary and third-party notices. The wording is verified
 * against the real build (merged manifest, dependency list) in
 * docs/android/RELEASE_CHECKLIST.md; keep the two in sync.
 */
export function PrivacyScreen({onBack}: PrivacyScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24},
      ]}>
      <Text style={styles.h1} accessibilityRole="header">
        Privacy
      </Text>
      <View style={styles.block}>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          Hand mode uses the front camera only while you are calibrating or
          playing. Camera images are analysed on your device to find your hands.
          They are never saved, recorded or sent anywhere.
        </Text>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          The game has no accounts, ads or analytics and does not need an
          internet connection. Touch mode never asks for the camera.
        </Text>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          You can turn the camera permission off at any time in Android
          Settings; the game will offer touch play instead.
        </Text>
      </View>

      <Text style={styles.h1} accessibilityRole="header">
        Licenses
      </Text>
      <View style={styles.block}>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          Hand tracking uses Google MediaPipe Hand Landmarker (Apache License
          2.0) and its bundled hand_landmarker model. Camera access uses
          AndroidX CameraX (Apache License 2.0). Rendering uses React Native
          and Skia (MIT / BSD-3-Clause).
        </Text>
        <Text style={shared.dim} maxFontSizeMultiplier={1.4}>
          Full notices: THIRD_PARTY_NOTICES.md in the source repository.
        </Text>
      </View>

      <Button label="Back" variant="primary" onPress={onBack} testID="privacy-back" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  content: {paddingHorizontal: 20, gap: 16},
  h1: {
    fontFamily: 'monospace',
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.cyan,
    letterSpacing: 3,
  },
  block: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(0,255,255,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
});
