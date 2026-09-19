import {useCallback, useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

export interface Settings {
  reducedMotion: boolean;
  haptics: boolean;
}

/**
 * In-memory player settings. Reduced motion starts from the OS accessibility
 * setting and follows changes to it until the player overrides it in-app.
 * Nothing is persisted: no storage dependency or permission is needed.
 */
export function useSettings() {
  const [reducedMotion, setReducedMotionState] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [haptics, setHaptics] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active && !overridden) {
          setReducedMotionState(enabled);
        }
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (!overridden) {
        setReducedMotionState(enabled);
      }
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [overridden]);

  const setReducedMotion = useCallback((value: boolean) => {
    setOverridden(true);
    setReducedMotionState(value);
  }, []);

  const settings: Settings = {reducedMotion, haptics};
  return {settings, setReducedMotion, setHaptics};
}
