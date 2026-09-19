/**
 * Optional haptic feedback. The game only depends on this small interface; a
 * concrete implementation is injected when available and haptics are enabled.
 */
export interface Haptics {
  slice(): void;
  bomb(): void;
  miss(): void;
}

export const noHaptics: Haptics = {
  slice() {},
  bomb() {},
  miss() {},
};
