import {StyleSheet} from 'react-native';

export const colors = {
  bg: '#000000',
  panel: 'rgba(0,10,20,0.92)',
  cyan: '#00FFFF',
  cyanDim: '#0A8A8A',
  gold: '#FFD700',
  red: '#FF3333',
  green: '#00FF88',
  text: '#E8FFFF',
  textDim: '#9BC',
} as const;

/** Minimum touch target (dp) for primary controls. */
export const MIN_TARGET = 56;

/** Menus stay a readable column on tablets and in landscape instead of stretching edge to edge. */
export const CONTENT_MAX_WIDTH = 600;
export const contentColumn = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const;

export const shared = StyleSheet.create({
  button: {
    minHeight: MIN_TARGET,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.cyan,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  buttonPrimary: {
    backgroundColor: colors.cyan,
  },
  buttonDanger: {
    borderColor: colors.red,
    backgroundColor: 'rgba(255,51,51,0.10)',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: colors.cyan,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: colors.bg,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  dim: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textDim,
  },
});
