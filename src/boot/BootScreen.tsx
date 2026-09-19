import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Canvas, createPicture, Picture} from '@shopify/react-native-skia';
import {runMmukoBoot, type BootCancel, type PhaseCallback} from './mmukoBoot';
import {
  PHASE_LABELS,
  MMUKO_BOOT_OUTCOME,
  type TrinaryState,
  type MmukoBootHandoff,
} from './types';
import {drawBootRing} from '../skia/drawBootRing';

interface BootScreenProps {
  onBootComplete: () => void;
  /** Time per phase. The original 800 ms made the sequence ~5.4 s; 250 ms is ~2 s. */
  phaseDelayMs?: number;
  /** Draw a still ring and skip the spinning/pulsing animation. */
  reducedMotion?: boolean;
}

export function BootScreen({
  onBootComplete,
  phaseDelayMs = 250,
  reducedMotion = false,
}: BootScreenProps): React.JSX.Element {
  const {width: screenW, height: screenH} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cx = screenW / 2;
  const cy = screenH / 2;

  const [phaseStates, setPhaseStates] = useState<Record<number, TrinaryState>>(
    {1: 'MAYBE', 2: 'MAYBE', 3: 'MAYBE', 4: 'MAYBE', 5: 'MAYBE', 6: 'MAYBE'},
  );
  const [handoff, setHandoff] = useState<MmukoBootHandoff | null>(null);
  const [completedPhases, setCompletedPhases] = useState(0);

  const angleRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const [picture, setPicture] = useState(() =>
    createPicture(canvas => {
      drawBootRing(canvas, cx, cy, 0, 0, screenW, screenH);
    }),
  );

  // Ring animation loop (a single redraw when reduced motion is requested).
  const draw = useCallback(() => {
    setPicture(
      createPicture(canvas => {
        drawBootRing(canvas, cx, cy, angleRef.current, completedPhases, screenW, screenH);
      }),
    );
  }, [cx, cy, screenW, screenH, completedPhases]);

  useEffect(() => {
    if (reducedMotion) {
      draw();
      return;
    }
    const animate = () => {
      angleRef.current += 0.015;
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [draw, reducedMotion]);

  // Run the (decorative) boot sequence on mount; stop it if the screen unmounts.
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true;
      onBootComplete();
    }
  }, [onBootComplete]);

  useEffect(() => {
    const cancel: BootCancel = {cancelled: false};
    let tail: ReturnType<typeof setTimeout> | null = null;
    const onPhase: PhaseCallback = (phase, state) => {
      setPhaseStates(prev => ({...prev, [phase]: state}));
      if (state === 'YES') {
        setCompletedPhases(phase);
      }
    };
    runMmukoBoot(onPhase, phaseDelayMs, cancel).then(result => {
      if (cancel.cancelled) {
        return;
      }
      setHandoff(result);
      tail = setTimeout(finish, 350);
    });
    return () => {
      cancel.cancelled = true;
      if (tail) {
        clearTimeout(tail);
      }
    };
  }, [finish, phaseDelayMs]);

  const isPassed = handoff?.outcome === MMUKO_BOOT_OUTCOME.PASS;

  return (
    <Pressable
      style={styles.container}
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel="Start-up animation. Tap to skip."
      accessibilityHint="Decorative animation only. No device or security checks are performed.">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>

      {/* Terminal HUD overlay */}
      <View
        style={[styles.hud, {top: insets.top + 24}]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants">
        <Text style={styles.title}>MMUKO-OS RING BOOT v0.1 • NSIGII</Text>
        <Text style={styles.subtitle}>firmware_id: NSIGII | revision: 0x0001</Text>
        <View style={styles.divider} />
        {[1, 2, 3, 4, 5, 6].map(phase => {
          const state = phaseStates[phase] ?? 'MAYBE';
          const passed = state === 'YES';
          return (
            <Text
              key={phase}
              style={[styles.phase, passed ? styles.phaseYes : styles.phaseMaybe]}>
              {passed ? '✓' : '○'} {PHASE_LABELS[phase]} → {state}
            </Text>
          );
        })}
        {isPassed && (
          <>
            <View style={styles.divider} />
            <Text style={styles.passLine}>
              MMUKO_BOOT_OUTCOME = PASS (0xAA)
            </Text>
            <Text style={styles.passLine}>
              completed_phases: 6/6
            </Text>
          </>
        )}
        <View style={styles.divider} />
        <Text style={styles.disclaimer}>
          Decorative start-up sequence. No device, camera or security checks are
          performed.
        </Text>
      </View>

      <Text style={[styles.skip, {bottom: insets.bottom + 24}]}>tap to skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  hud: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderColor: '#00FFFF',
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  title: {
    fontFamily: 'monospace',
    color: '#00FFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'monospace',
    color: '#008888',
    fontSize: 11,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#00FFFF',
    opacity: 0.3,
    marginVertical: 6,
  },
  phase: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginVertical: 1,
  },
  phaseYes: {
    color: '#00FF00',
  },
  phaseMaybe: {
    color: '#FFFF00',
  },
  passLine: {
    fontFamily: 'monospace',
    color: '#00FF88',
    fontSize: 11,
    marginVertical: 1,
  },
  disclaimer: {
    fontFamily: 'monospace',
    color: '#9AA',
    fontSize: 10,
  },
  skip: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: 'monospace',
    color: '#00FFFF',
    opacity: 0.6,
    fontSize: 12,
    letterSpacing: 2,
  },
});
