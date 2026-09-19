import React from 'react';
import {Pressable, Text} from 'react-native';
import {shared} from './theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger';
  accessibilityHint?: string;
  testID?: string;
  disabled?: boolean;
}

/** Large (>= 56 dp), labelled button used across menus. */
export function Button({
  label,
  onPress,
  variant = 'default',
  accessibilityHint,
  testID,
  disabled,
}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled: !!disabled}}
      testID={testID}
      style={({pressed}) => [
        shared.button,
        variant === 'primary' && shared.buttonPrimary,
        variant === 'danger' && shared.buttonDanger,
        pressed && shared.buttonPressed,
        disabled && shared.buttonPressed,
      ]}>
      <Text
        style={[shared.buttonText, variant === 'primary' && shared.buttonTextPrimary]}
        maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}
