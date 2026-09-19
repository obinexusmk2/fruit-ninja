import React from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {APP_TAGLINE, APP_TITLE} from '../app/branding';
import {DIFFICULTY_RULES, type Difficulty} from '../game/constants';
import {Button} from './Button';
import {colors, contentColumn, MIN_TARGET, shared} from './theme';

const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: Difficulty;
  title: string;
  detail: string;
}> = [
  {
    value: 'casual',
    title: `Casual · ${DIFFICULTY_RULES.casual.lives} lives`,
    detail: 'A gentle start: single fruit and no bombs for the first few seconds.',
  },
  {
    value: 'challenge',
    title: `Challenge · ${DIFFICULTY_RULES.challenge.lives} lives`,
    detail: 'The original rules. Miss three fruit and it is over.',
  },
  {
    value: 'practice',
    title: 'Practice · no bombs',
    detail: `Fruit only, ${DIFFICULTY_RULES.practice.lives} lives. Learn the swipe.`,
  },
];

/** Game-type picker: one radio group, each option a large labelled target. */
function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (v: Difficulty) => void;
}): React.JSX.Element {
  return (
    <View style={styles.panel} accessibilityRole="radiogroup" testID="difficulty-group">
      <Text style={shared.body} maxFontSizeMultiplier={1.4}>
        Game type
      </Text>
      {DIFFICULTY_OPTIONS.map(o => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{checked: selected}}
            accessibilityLabel={`${o.title}. ${o.detail}`}
            testID={`difficulty-${o.value}`}
            style={[styles.option, selected && styles.optionSelected]}>
            <Text style={[shared.body, styles.optionTitle]} maxFontSizeMultiplier={1.4}>
              {selected ? '● ' : '○ '}
              {o.title}
            </Text>
            <Text style={shared.dim} maxFontSizeMultiplier={1.4}>
              {o.detail}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface HomeScreenProps {
  difficulty: Difficulty;
  onDifficultyChange: (value: Difficulty) => void;
  oneHand: boolean;
  reducedMotion: boolean;
  haptics: boolean;
  onStartTouch: () => void;
  onStartHand: () => void;
  onOneHandChange: (value: boolean) => void;
  onReducedMotionChange: (value: boolean) => void;
  onHapticsChange: (value: boolean) => void;
  onOpenPrivacy: () => void;
}

function Row({
  label,
  hint,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
        <Text style={shared.dim} maxFontSizeMultiplier={1.4}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityHint={hint}
        testID={testID}
        trackColor={{false: '#334', true: colors.cyanDim}}
        thumbColor={value ? colors.cyan : '#889'}
      />
    </View>
  );
}

/** Start / mode selection. The touch alternative is always one tap away. */
export function HomeScreen({
  difficulty,
  onDifficultyChange,
  oneHand,
  reducedMotion,
  haptics,
  onStartTouch,
  onStartHand,
  onOneHandChange,
  onReducedMotionChange,
  onHapticsChange,
  onOpenPrivacy,
}: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        contentColumn,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
        },
      ]}>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
        {APP_TITLE}
      </Text>
      <Text style={shared.dim}>{APP_TAGLINE}</Text>

      <View style={styles.panel}>
        <Text style={shared.body} maxFontSizeMultiplier={1.4}>
          Slice fruit, dodge bombs. Each fruit you miss costs a life, and a bomb
          ends the game. Slice 3 or more fruit in one swipe for a combo that
          doubles that swipe's points.
        </Text>
        <Text style={[shared.dim, styles.tip]} maxFontSizeMultiplier={1.4}>
          Hand mode: stand the phone on a stable surface, then raise your hands
          in front of the front camera.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          label="Play with hands (camera)"
          variant="primary"
          onPress={onStartHand}
          accessibilityHint="Uses the front camera to track your hands"
          testID="start-hand"
        />
        <Button
          label="Play with touch"
          onPress={onStartTouch}
          accessibilityHint="Swipe the screen with your fingers. No camera needed"
          testID="start-touch"
        />
      </View>

      <DifficultyPicker value={difficulty} onChange={onDifficultyChange} />

      <View style={styles.panel}>
        <Row
          label="One-hand mode"
          hint="One blade and one hand. Recommended if you can only use one hand."
          value={oneHand}
          onValueChange={onOneHandChange}
          testID="toggle-one-hand"
        />
        <Row
          label="Reduce motion"
          hint="Less animation: no spinning intro, splashes or fruit rotation."
          value={reducedMotion}
          onValueChange={onReducedMotionChange}
          testID="toggle-reduce-motion"
        />
        <Row
          label="Vibration"
          hint="Short vibration when you slice."
          value={haptics}
          onValueChange={onHapticsChange}
          testID="toggle-haptics"
        />
      </View>

      <Button
        label="Privacy and licenses"
        onPress={onOpenPrivacy}
        testID="open-privacy"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  content: {gap: 18},
  title: {
    fontFamily: 'monospace',
    fontSize: 38,
    fontWeight: 'bold',
    color: colors.gold,
    letterSpacing: 4,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(0,255,255,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  tip: {marginTop: 2},
  buttons: {gap: 12},
  option: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(0,255,255,0.25)',
    padding: 12,
    gap: 2,
  },
  optionSelected: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(0,255,255,0.10)',
  },
  optionTitle: {fontWeight: 'bold'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56},
  rowText: {flex: 1, gap: 2},
});
